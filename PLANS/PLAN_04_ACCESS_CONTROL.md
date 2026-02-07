# PLAN_04: Access Control & Permissions

**Status**: Draft
**Dependencies**: PLAN_01 (Binder/Form System)
**Created**: 2026-02-07

---

## 1. Current Role Matrix

### Existing Roles (from Better Auth + profiles table)

| Role | Current Permissions |
|------|---------------------|
| **owner** | - Full system access<br>- Manage all users<br>- Create/edit inspection templates<br>- View all inspections<br>- Access analytics<br>- Manage locations<br>- Generate invite codes |
| **admin** | - Manage users (non-owners)<br>- Create/edit inspection templates<br>- View all inspections<br>- Access analytics<br>- Manage locations<br>- Generate invite codes |
| **nurse** | - View assigned inspections<br>- Complete inspections<br>- View limited analytics<br>- Cannot manage users or templates |
| **inspector** | - View assigned inspections<br>- Complete inspections<br>- Submit inspection responses<br>- Cannot manage users or templates |

### Current Authorization Pattern

From `lib/server/auth-helpers.ts`:
```typescript
export async function requireRole(roles: string[]) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")

  const profile = await getProfileByUserId(session.user.id)
  if (!profile || !roles.includes(profile.role)) {
    throw new Error("Forbidden")
  }
  return { session, profile }
}
```

**Issues with Current System**:
- Role-based only (no granular permissions)
- Hard to add nuanced access (e.g., "can edit forms but not delete")
- No way to restrict inspector to specific binders
- All admins have identical permissions

---

## 2. New Permissions Needed for Binder/Form System

### Permission Categories

| Category | Actions | Current Roles | New Granularity Needed? |
|----------|---------|---------------|-------------------------|
| **Binder Management** | create, view, edit, archive | owner, admin | Yes - some admins may only view |
| **Form Template Management** | create, view, edit, disable | owner, admin | Yes - separate form designers |
| **Form Field Management** | add, edit, remove, reorder | owner, admin | Yes - field-level control |
| **Form Responses** | submit, view_own, view_all, edit | all roles | Yes - nurses/inspectors submit, admins view all |
| **Dashboard Analytics** | view_basic, view_advanced, export | owner, admin (advanced), nurse/inspector (basic) | Yes - tiered analytics access |
| **User Management** | invite, edit, deactivate, delete | owner, admin | Yes - admins shouldn't delete users |
| **Google Sync Config** | configure, view, disable | owner only | Maybe - admins may need view access |
| **Location Management** | create, edit, delete, assign_to_user | owner, admin | No - current system works |
| **Regulatory Settings** | edit_frequencies, edit_categories, edit_compliance_rules | owner only | Yes - compliance officer role needed |

---

## 3. Recommended Role Updates

### Option A: Keep Roles, Add Permission Flags (RECOMMENDED)

**Rationale**: Simplest migration path, minimal DB changes, easy to understand.

**New Roles**:
- **owner** (unchanged - god mode)
- **admin** (unchanged for now)
- **compliance_officer** (NEW) - Manages binders, forms, compliance rules, cannot manage users
- **charge_nurse** (NEW) - Can view all inspections in their location, assign tasks, limited analytics
- **nurse** (unchanged)
- **inspector** (unchanged)

**Add Flags to `profiles` Table**:
```sql
ALTER TABLE profiles ADD COLUMN can_manage_binders BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN can_manage_forms BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN can_view_all_responses BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN can_export_reports BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN can_configure_integrations BOOLEAN DEFAULT FALSE;
```

**Default Flags by Role**:
```typescript
const rolePermissions = {
  owner: {
    can_manage_binders: true,
    can_manage_forms: true,
    can_view_all_responses: true,
    can_export_reports: true,
    can_configure_integrations: true,
  },
  admin: {
    can_manage_binders: true,
    can_manage_forms: true,
    can_view_all_responses: true,
    can_export_reports: true,
    can_configure_integrations: false,
  },
  compliance_officer: {
    can_manage_binders: true,
    can_manage_forms: true,
    can_view_all_responses: true,
    can_export_reports: true,
    can_configure_integrations: false,
  },
  charge_nurse: {
    can_manage_binders: false,
    can_manage_forms: false,
    can_view_all_responses: true,
    can_export_reports: true,
    can_configure_integrations: false,
  },
  nurse: {
    can_manage_binders: false,
    can_manage_forms: false,
    can_view_all_responses: false,
    can_export_reports: false,
    can_configure_integrations: false,
  },
  inspector: {
    can_manage_binders: false,
    can_manage_forms: false,
    can_view_all_responses: false,
    can_export_reports: false,
    can_configure_integrations: false,
  },
}
```

### Option B: Full RBAC with Permissions Table (Future-Proof)

**Rationale**: Scalable, allows per-user permission overrides, industry standard.

**New Tables**:
```sql
-- Define all available permissions
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,  -- 'binder', 'form', 'response', 'user', etc.
  action TEXT NOT NULL,    -- 'create', 'read', 'update', 'delete', 'export'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- Map roles to permissions (default grants)
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL REFERENCES profiles(role),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- Override permissions per user (optional)
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  granted BOOLEAN DEFAULT TRUE,  -- FALSE = explicit deny
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);
```

**Pros**: Maximum flexibility, auditable, can revoke specific permissions per user.
**Cons**: Complexity, more queries, overkill for 4-10 user system.

**Decision**: Use **Option A** for MVP, migrate to **Option B** if customer base grows beyond 20 users per org.

---

## 4. Implementation Approach

### 4.1 Database Migration

**File**: `supabase/migrations/004_access_control_enhancements.sql`

```sql
-- Add new roles
ALTER TABLE profiles
  DROP CONSTRAINT profiles_role_check,
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'compliance_officer', 'charge_nurse', 'nurse', 'inspector'));

-- Add permission flags
ALTER TABLE profiles
  ADD COLUMN can_manage_binders BOOLEAN DEFAULT FALSE,
  ADD COLUMN can_manage_forms BOOLEAN DEFAULT FALSE,
  ADD COLUMN can_view_all_responses BOOLEAN DEFAULT FALSE,
  ADD COLUMN can_export_reports BOOLEAN DEFAULT FALSE,
  ADD COLUMN can_configure_integrations BOOLEAN DEFAULT FALSE;

-- Set defaults for existing users
UPDATE profiles SET
  can_manage_binders = (role IN ('owner', 'admin')),
  can_manage_forms = (role IN ('owner', 'admin')),
  can_view_all_responses = (role IN ('owner', 'admin')),
  can_export_reports = (role IN ('owner', 'admin')),
  can_configure_integrations = (role = 'owner');

-- Add indexes for permission checks
CREATE INDEX idx_profiles_role_permissions ON profiles(role, can_manage_binders, can_manage_forms);
```

### 4.2 Update `auth-helpers.ts`

**File**: `lib/server/auth-helpers.ts`

Add new helper functions:

```typescript
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export type Profile = {
  id: string
  user_id: string
  role: string
  can_manage_binders: boolean
  can_manage_forms: boolean
  can_view_all_responses: boolean
  can_export_reports: boolean
  can_configure_integrations: boolean
}

// Existing requireRole helper
export async function requireRole(roles: string[]) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")

  const profile = await getProfileByUserId(session.user.id)
  if (!profile || !roles.includes(profile.role)) {
    throw new Error("Forbidden")
  }
  return { session, profile }
}

// NEW: Check specific permission flag
export async function requirePermission(permission: keyof Profile) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")

  const profile = await getProfileByUserId(session.user.id)
  if (!profile) throw new Error("Forbidden")

  // Owner always has all permissions
  if (profile.role === 'owner') return { session, profile }

  // Check specific permission flag
  if (!profile[permission]) {
    throw new Error(`Forbidden: Missing permission ${permission}`)
  }

  return { session, profile }
}

// NEW: Check if user can manage binders
export async function requireBinderManagement() {
  return requirePermission('can_manage_binders')
}

// NEW: Check if user can manage forms
export async function requireFormManagement() {
  return requirePermission('can_manage_forms')
}

// NEW: Check if user can view all responses
export async function requireViewAllResponses() {
  return requirePermission('can_view_all_responses')
}

// NEW: Check if user can export reports
export async function requireExportReports() {
  return requirePermission('can_export_reports')
}

// NEW: Check if user can configure integrations
export async function requireIntegrationConfig() {
  return requirePermission('can_configure_integrations')
}

// NEW: Get profile with all permissions
async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const result = await db.query(
    `SELECT
      id, user_id, role,
      can_manage_binders, can_manage_forms,
      can_view_all_responses, can_export_reports,
      can_configure_integrations
    FROM profiles WHERE user_id = $1`,
    [userId]
  )
  return result.rows[0] || null
}
```

### 4.3 API Endpoint Authorization Patterns

#### Pattern 1: Binder Management Endpoints

```typescript
// app/api/binders/route.ts
import { requireBinderManagement } from "@/lib/server/auth-helpers"

export async function POST(request: Request) {
  const { profile } = await requireBinderManagement()

  // Only owner/admin/compliance_officer can create binders
  const data = await request.json()
  const binder = await createBinder(data)
  return Response.json(binder)
}

export async function GET(request: Request) {
  const { profile } = await requireRole(['owner', 'admin', 'compliance_officer', 'charge_nurse', 'nurse', 'inspector'])

  // All roles can view binders (filtered by assignment)
  const binders = await getBindersForUser(profile.id)
  return Response.json(binders)
}
```

#### Pattern 2: Form Response Viewing

```typescript
// app/api/responses/[id]/route.ts
import { requireRole } from "@/lib/server/auth-helpers"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { profile } = await requireRole(['owner', 'admin', 'compliance_officer', 'charge_nurse', 'nurse', 'inspector'])
  const { id } = await params

  const response = await getFormResponseById(id)

  // Check if user can view this response
  if (!profile.can_view_all_responses) {
    // User can only view their own submissions
    if (response.submitted_by !== profile.user_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  return Response.json(response)
}
```

#### Pattern 3: Dashboard Export

```typescript
// app/api/dashboard/export/route.ts
import { requireExportReports } from "@/lib/server/auth-helpers"

export async function POST(request: Request) {
  const { profile } = await requireExportReports()

  const data = await request.json()
  const report = await generateComplianceReport(data)
  return Response.json(report)
}
```

### 4.4 Client-Side Permission Checks

**File**: `lib/permissions.ts`

```typescript
import { Profile } from "@/lib/server/auth-helpers"

export function canManageBinders(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.role === 'owner' || profile.can_manage_binders
}

export function canManageForms(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.role === 'owner' || profile.can_manage_forms
}

export function canViewAllResponses(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.role === 'owner' || profile.can_view_all_responses
}

export function canExportReports(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.role === 'owner' || profile.can_export_reports
}

export function canConfigureIntegrations(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.role === 'owner' || profile.can_configure_integrations
}

export function isOwnerOrAdmin(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.role === 'owner' || profile.role === 'admin'
}
```

**Usage in Components**:

```tsx
"use client"

import { useSession } from "@/lib/auth-client"
import { canManageBinders } from "@/lib/permissions"

export function BinderList() {
  const { data: session } = useSession()
  const profile = session?.user?.profile

  return (
    <div>
      {canManageBinders(profile) && (
        <Button onClick={() => router.push("/binders/new")}>
          Create Binder
        </Button>
      )}
      {/* Binder list */}
    </div>
  )
}
```

---

## 5. Binder-Level Access Control

### Requirement

**Q**: Can certain roles only see certain binders?
**A**: Yes. Inspectors/nurses may be assigned to specific binders (e.g., "Life Safety" inspector only sees Life Safety forms).

### Implementation: Assignment-Based Access

**New Table**: `binder_assignments`

```sql
CREATE TABLE binder_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(user_id),
  UNIQUE(binder_id, user_id)
);

CREATE INDEX idx_binder_assignments_user ON binder_assignments(user_id);
CREATE INDEX idx_binder_assignments_binder ON binder_assignments(binder_id);
```

**Query Pattern**:

```typescript
// Get binders visible to user
export async function getBindersForUser(userId: string, role: string) {
  // Owner/admin/compliance_officer see all binders
  if (['owner', 'admin', 'compliance_officer'].includes(role)) {
    return db.query(`SELECT * FROM binders ORDER BY name`)
  }

  // Nurses/inspectors only see assigned binders
  return db.query(
    `SELECT b.* FROM binders b
     INNER JOIN binder_assignments ba ON ba.binder_id = b.id
     WHERE ba.user_id = $1
     ORDER BY b.name`,
    [userId]
  )
}
```

**UI for Assignment** (Owner/Admin page):

```
┌─────────────────────────────────────┐
│ Binder: Life Safety Code            │
├─────────────────────────────────────┤
│ Assigned Inspectors:                │
│  [x] John Doe (inspector)           │
│  [x] Jane Smith (inspector)         │
│  [ ] Bob Lee (nurse)                │
│                                     │
│ [ Save Assignments ]                │
└─────────────────────────────────────┘
```

**API Endpoint**:

```typescript
// POST /api/binders/[id]/assignments
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { profile } = await requireBinderManagement()
  const { id } = await params
  const { user_ids } = await request.json()

  // Replace all assignments for this binder
  await db.query(`DELETE FROM binder_assignments WHERE binder_id = $1`, [id])

  for (const userId of user_ids) {
    await db.query(
      `INSERT INTO binder_assignments (binder_id, user_id, assigned_by)
       VALUES ($1, $2, $3)`,
      [id, userId, profile.user_id]
    )
  }

  return Response.json({ success: true })
}
```

---

## 6. Migration Strategy

### Phase 1: Add Permission Flags (Week 1)

1. Run migration `004_access_control_enhancements.sql`
2. Update `auth-helpers.ts` with new permission functions
3. Update `lib/permissions.ts` with client-side checks
4. Test with existing users (all should retain current access)

### Phase 2: Update API Endpoints (Week 2)

1. Replace `requireRole` with specific permission checks in critical endpoints:
   - Binder management → `requireBinderManagement()`
   - Form management → `requireFormManagement()`
   - Dashboard export → `requireExportReports()`
   - Google sync config → `requireIntegrationConfig()`
2. Add authorization checks to existing endpoints
3. Test each endpoint with different roles

### Phase 3: Add Binder Assignments (Week 3)

1. Create `binder_assignments` table
2. Build assignment UI for owner/admin
3. Update `getBindersForUser()` to filter by assignments
4. Update dashboard queries to respect assignments
5. Notify existing inspectors of their assignments

### Phase 4: Add New Roles (Week 4)

1. Add `compliance_officer` and `charge_nurse` to role constraint
2. Update invite flow to allow selecting new roles
3. Update users page to show new roles
4. Document role differences in help/onboarding

### Backward Compatibility

**Critical**: Existing users must retain access.

```sql
-- Migration ensures existing admins get all flags
UPDATE profiles SET
  can_manage_binders = TRUE,
  can_manage_forms = TRUE,
  can_view_all_responses = TRUE,
  can_export_reports = TRUE
WHERE role IN ('owner', 'admin');

-- Existing nurses/inspectors get limited flags
UPDATE profiles SET
  can_manage_binders = FALSE,
  can_manage_forms = FALSE,
  can_view_all_responses = FALSE,
  can_export_reports = FALSE
WHERE role IN ('nurse', 'inspector');
```

**Testing Checklist**:
- [ ] Owner can still do everything
- [ ] Admin can still manage users and templates
- [ ] Nurse can still submit inspections
- [ ] Inspector can still submit inspections
- [ ] No users locked out of critical functions

---

## 7. Future Enhancements (Post-MVP)

1. **Per-User Permission Overrides**: Allow owner to grant specific permissions to individual users (e.g., give one nurse export access)
2. **Location-Based Access Control**: Restrict users to specific locations (multi-facility orgs)
3. **Audit Log**: Track who changed permissions and when
4. **Time-Based Permissions**: Temporary access grants (e.g., external auditor for 30 days)
5. **API Key Management**: Allow programmatic access with scoped API keys for n8n/integrations

---

## Summary

**Chosen Approach**: Option A (Role + Flags) for MVP.

**New Roles**:
- `compliance_officer` (manages binders/forms, no user management)
- `charge_nurse` (views all responses in their location, limited analytics)

**New Permission Flags**:
- `can_manage_binders`
- `can_manage_forms`
- `can_view_all_responses`
- `can_export_reports`
- `can_configure_integrations`

**Binder Assignment**: `binder_assignments` table restricts nurse/inspector visibility.

**Migration**: Backward-compatible, existing users retain current access.

**Implementation Time**: 4 weeks (1 week per phase).
