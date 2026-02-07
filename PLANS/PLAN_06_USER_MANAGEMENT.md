# PLAN_06: User Management & Invites

**Status**: Draft
**Dependencies**: PLAN_04 (Access Control)
**Created**: 2026-02-07

---

## 1. Current State

### 1.1 Authentication System

**Framework**: Better Auth (v1.0+)
**Method**: Email/Password authentication
**Database**: Supabase Postgres (server-side only access)
**Session Duration**: 90 days with daily sliding refresh

**Better Auth Configuration** (`lib/auth.ts`):
```typescript
export const auth = betterAuth({
  database: { /* Postgres connection */ },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,  // Currently disabled
  },
  session: {
    expiresIn: 60 * 60 * 24 * 90,      // 90 days
    updateAge: 60 * 60 * 24,           // Refresh daily
  },
})
```

### 1.2 Current Invite System

**Table**: `invite_codes`

```sql
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'nurse', 'inspector')),
  created_by UUID NOT NULL REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);
```

**Current Flow**:
1. Owner/Admin generates invite code (8 random chars)
2. Code is SHA-256 hashed and stored in `code_hash` column
3. Invite link: `https://app.example.com/sign-up?invite=ABC12345`
4. User visits link, signs up with email/password
5. On signup, code is validated:
   - Check `expires_at` > NOW()
   - Check `used_count` < `max_uses`
   - Check `is_active = true`
6. Increment `used_count`, create user account, assign role

**Current Limitations**:
- ❌ Codes expire (hard deadline, no refresh)
- ❌ Single-use codes by default (friction for recruiting multiple users)
- ❌ No way to regenerate expired code
- ❌ No bulk user creation
- ❌ No self-service password reset (admin must manually reset)

### 1.3 Profiles Table

**Table**: `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'nurse', 'inspector')),
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Current Fields**:
- `user_id`: Links to Better Auth `user` table
- `name`: Full name
- `email`: Email address (synced from Better Auth)
- `role`: User role (see PLAN_04 for role details)
- `must_change_password`: Forces password change on next login

**Missing Fields**:
- Phone number
- Profile photo
- Department/Specialty
- Last login timestamp
- Deactivation status
- Account notes (for admin reference)

### 1.4 Current Users Page

**Route**: `/users` (Owner/Admin only)

**Features**:
- List all users with name, email, role
- Generate invite codes
- Edit user role (via modal)
- No delete/deactivate option
- No bulk operations

---

## 2. Issues to Solve

### Issue 1: Invite Codes Expire Without Recovery

**Problem**: If an invite code expires (e.g., 7 days), owner must create a new code. Previous invite link becomes dead.

**Impact**: Friction when recruiting inspectors. If owner sends link on Friday and inspector tries to use it next Monday (after 7-day expiry), link is broken.

**Solution**: Add "refresh" option to regenerate expired code without changing URL.

### Issue 2: No Bulk User Creation

**Problem**: Owner wants to onboard 10 inspectors at once. Must create 10 individual invite codes.

**Impact**: Time-consuming, error-prone (manual data entry), difficult to track who accepted.

**Solution**: CSV upload feature to create multiple users in one batch.

### Issue 3: No Self-Service Password Reset

**Problem**: If inspector forgets password, they have no way to reset it. Must contact admin.

**Impact**: Support burden on admin, delays inspector access.

**Solution**: Add email-based password reset flow with magic link.

### Issue 4: Limited Profile Information

**Problem**: No phone number, profile photo, or department info. Hard to identify users in admin panel.

**Impact**: Admin must mentally map email → real person. No visual recognition.

**Solution**: Add profile fields for phone, photo, department/specialty.

### Issue 5: No User Deactivation

**Problem**: When inspector leaves, admin has no way to disable account without deleting user (which removes historical data).

**Impact**: Can't maintain audit trail. Risk of ex-employee retaining access.

**Solution**: Add soft-delete (deactivation) feature using Better Auth's ban system.

### Issue 6: No Activity Tracking

**Problem**: Admin can't see when users last logged in or completed an inspection.

**Impact**: Can't identify inactive accounts. No visibility into user engagement.

**Solution**: Track last login timestamp and last inspection completed timestamp.

---

## 3. Planned Improvements

### 3.1 Permanent Invite Links

**Feature**: Generate invite codes that never expire (or expire after 1 year).

**Database Change**: Add `is_permanent` flag to `invite_codes` table.

```sql
ALTER TABLE invite_codes
  ADD COLUMN is_permanent BOOLEAN DEFAULT FALSE;

-- Update existing non-expired codes to be permanent (owner decision)
-- UPDATE invite_codes SET is_permanent = TRUE WHERE expires_at IS NULL;
```

**UI Update**:

```
┌─────────────────────────────────────────────────┐
│ Generate Invite Code                            │
├─────────────────────────────────────────────────┤
│                                                 │
│ Role: [Inspector ▼]                             │
│                                                 │
│ Expiration:                                     │
│ ( ) 7 days                                      │
│ ( ) 30 days                                     │
│ (•) Never expire (permanent link)               │
│                                                 │
│ Max Uses:                                       │
│ ( ) Single-use                                  │
│ ( ) 10 uses                                     │
│ (•) Unlimited                                   │
│                                                 │
│ [Generate Code]                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Validation Logic**:

```typescript
export async function validateInviteCode(code: string) {
  const hash = await hashCode(code)
  const invite = await db.query(
    `SELECT * FROM invite_codes WHERE code_hash = $1 AND is_active = true`,
    [hash]
  )

  if (!invite.rows[0]) throw new Error("Invalid invite code")

  const inv = invite.rows[0]

  // Check expiration (skip if permanent)
  if (!inv.is_permanent && inv.expires_at && new Date(inv.expires_at) < new Date()) {
    throw new Error("Invite code expired")
  }

  // Check max uses
  if (inv.max_uses && inv.used_count >= inv.max_uses) {
    throw new Error("Invite code has been fully used")
  }

  return inv
}
```

### 3.2 Invite Link Regeneration

**Feature**: Refresh expired invite code to extend its lifetime without changing the code itself.

**UI Update** (on existing Invite Codes list):

```
┌────────────────────────────────────────────────────────┐
│ Active Invite Codes                                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Code      Role       Expires     Uses   Actions       │
│ ───────────────────────────────────────────────────── │
│ ABC12345  Inspector  Expired     0/10   [Refresh]     │
│ XYZ98765  Nurse      Feb 14      3/10   [Deactivate]  │
│ QWE45678  Admin      Never        1/∞    [Deactivate]  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Refresh Action**:
- Extends `expires_at` by another 7/30 days (configurable)
- Keeps same code (no URL change)
- Resets `used_count` to 0 (optional, configurable)

**API Endpoint**: `PATCH /api/invite-codes/[id]/refresh`

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { profile } = await requireRole(['owner', 'admin'])
  const { id } = await params
  const { extend_days } = await request.json()

  const newExpiry = new Date()
  newExpiry.setDate(newExpiry.getDate() + extend_days)

  await db.query(
    `UPDATE invite_codes SET expires_at = $1, updated_at = NOW() WHERE id = $2`,
    [newExpiry, id]
  )

  return Response.json({ success: true, expires_at: newExpiry })
}
```

### 3.3 Bulk User Import

**Feature**: Upload CSV with user data to create multiple users at once.

**CSV Format**:
```csv
name,email,role,phone,department
John Doe,john@example.com,inspector,555-1234,Life Safety
Jane Smith,jane@example.com,nurse,555-5678,Infection Control
Bob Lee,bob@example.com,inspector,555-9012,Environment
```

**UI Flow**:

```
┌─────────────────────────────────────────────────┐
│ Bulk User Import                                │
├─────────────────────────────────────────────────┤
│                                                 │
│ Step 1: Download CSV Template                   │
│ [Download Template]                             │
│                                                 │
│ Step 2: Fill in User Data                       │
│ Add user details to the CSV file.               │
│                                                 │
│ Step 3: Upload CSV                              │
│ ┌─────────────────────────────────────────┐   │
│ │ Drag & drop CSV here or click to browse │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Step 4: Review & Confirm                        │
│ (Preview table appears after upload)            │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Name       Email            Role        │   │
│ │ ───────────────────────────────────────│   │
│ │ John Doe   john@example.com  Inspector │   │
│ │ Jane Smith jane@example.com  Nurse     │   │
│ │ Bob Lee    bob@example.com   Inspector │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ [Cancel] [Import 3 Users]                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Backend Processing**:

```typescript
// POST /api/users/bulk-import
export async function POST(request: Request) {
  const { profile } = await requireRole(['owner', 'admin'])
  const formData = await request.formData()
  const file = formData.get('csv') as File

  // Parse CSV
  const csvText = await file.text()
  const users = parseCSV(csvText)

  const results = []
  for (const user of users) {
    try {
      // Create user with Better Auth
      const authUser = await auth.api.signUpEmail({
        email: user.email,
        password: generateTempPassword(),  // Random 12-char password
        name: user.name,
      })

      // Create profile
      await db.query(
        `INSERT INTO profiles (user_id, name, email, role, phone, department, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [authUser.id, user.name, user.email, user.role, user.phone, user.department]
      )

      // Send welcome email with temp password
      await sendWelcomeEmail(user.email, user.name, tempPassword)

      results.push({ email: user.email, status: 'success' })
    } catch (error) {
      results.push({ email: user.email, status: 'error', message: error.message })
    }
  }

  return Response.json({ results })
}
```

**Welcome Email Template**:

```
Subject: Welcome to [App Name] - Account Created

Hi {name},

Your account has been created! Here are your login credentials:

Email: {email}
Temporary Password: {temp_password}

Please log in at: {app_url}/sign-in

IMPORTANT: You will be required to change your password on first login.

If you have any questions, contact your administrator.

Best regards,
The [App Name] Team
```

### 3.4 Improved Onboarding

**Current Flow**:
1. User signs up with invite code
2. Redirected to dashboard
3. (Optional) `must_change_password` flag forces password change

**Improved Flow**:
1. User receives welcome email with temp password (from bulk import) OR uses invite link
2. On first login, forced to change password (if `must_change_password = true`)
3. After password change, redirected to onboarding checklist:
   - [ ] Set profile photo
   - [ ] Add phone number
   - [ ] Review assigned binders (if inspector/nurse)
   - [ ] Watch tutorial video (optional)
4. Redirect to dashboard

**Onboarding Page** (`/onboarding`):

```
┌─────────────────────────────────────────────────┐
│ Welcome to [App Name]!                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ Let's get your account set up.                  │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ ✓ Change Password (completed)           │   │
│ │ ○ Upload Profile Photo                  │   │
│ │ ○ Add Phone Number                      │   │
│ │ ○ Review Assigned Inspections           │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ [Skip for Now] [Continue]                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Track Onboarding Completion**:

```sql
ALTER TABLE profiles
  ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
```

### 3.5 Profile Enhancements

**Add New Columns to `profiles` Table**:

```sql
-- Migration 006_profile_enhancements.sql
ALTER TABLE profiles
  ADD COLUMN phone TEXT,
  ADD COLUMN profile_photo_url TEXT,
  ADD COLUMN department TEXT,
  ADD COLUMN specialty TEXT,  -- e.g., "Life Safety Inspector", "Infection Control Nurse"
  ADD COLUMN last_login_at TIMESTAMPTZ,
  ADD COLUMN last_inspection_at TIMESTAMPTZ,
  ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN deactivated_at TIMESTAMPTZ,
  ADD COLUMN deactivated_by UUID REFERENCES profiles(user_id),
  ADD COLUMN admin_notes TEXT,  -- Private notes for admin reference
  ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

-- Create index for active users lookup
CREATE INDEX idx_profiles_active ON profiles(is_active);

-- Create index for last login tracking
CREATE INDEX idx_profiles_last_login ON profiles(last_login_at DESC);
```

**Profile Photo Upload**:

Use Supabase Storage for profile photos.

```typescript
// POST /api/users/[id]/photo
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { profile } = await requireRole(['owner', 'admin', 'nurse', 'inspector'])
  const { id } = await params

  // Only allow editing own profile or admin editing any
  if (profile.id !== id && !['owner', 'admin'].includes(profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('photo') as File

  // Upload to Supabase Storage
  const fileName = `${id}-${Date.now()}.${file.name.split('.').pop()}`
  const { data, error } = await supabase.storage
    .from('profile-photos')
    .upload(fileName, file, { upsert: true })

  if (error) throw error

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(fileName)

  // Update profile
  await db.query(
    `UPDATE profiles SET profile_photo_url = $1, updated_at = NOW() WHERE id = $2`,
    [urlData.publicUrl, id]
  )

  return Response.json({ url: urlData.publicUrl })
}
```

**Supabase Storage Bucket**:

```sql
-- Create profile-photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true);

-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload their own profile photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all profile photos
CREATE POLICY "Public read access to profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');
```

### 3.6 User Deactivation (Soft Delete)

**Feature**: Disable user account without deleting historical data.

**Implementation**: Use Better Auth's ban system + custom `is_active` flag.

**Deactivation Flow**:
1. Admin clicks "Deactivate" on user
2. User's `is_active` set to `false`
3. User banned in Better Auth (session invalidated)
4. User cannot log in
5. User's inspections remain in database (for audit trail)

**API Endpoint**: `POST /api/users/[id]/deactivate`

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { profile } = await requireRole(['owner', 'admin'])
  const { id } = await params

  // Prevent self-deactivation
  if (profile.id === id) {
    return Response.json({ error: "Cannot deactivate your own account" }, { status: 400 })
  }

  // Get user_id from profile
  const userResult = await db.query(`SELECT user_id FROM profiles WHERE id = $1`, [id])
  const userId = userResult.rows[0].user_id

  // Ban user in Better Auth
  await auth.api.banUser({ userId })

  // Update profile
  await db.query(
    `UPDATE profiles SET
      is_active = false,
      deactivated_at = NOW(),
      deactivated_by = $1,
      updated_at = NOW()
    WHERE id = $2`,
    [profile.user_id, id]
  )

  return Response.json({ success: true })
}
```

**Reactivation Flow**: `POST /api/users/[id]/activate`

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { profile } = await requireRole(['owner', 'admin'])
  const { id } = await params

  const userResult = await db.query(`SELECT user_id FROM profiles WHERE id = $1`, [id])
  const userId = userResult.rows[0].user_id

  // Unban user in Better Auth
  await auth.api.unbanUser({ userId })

  // Update profile
  await db.query(
    `UPDATE profiles SET
      is_active = true,
      deactivated_at = NULL,
      deactivated_by = NULL,
      updated_at = NOW()
    WHERE id = $2`,
    [id]
  )

  return Response.json({ success: true })
}
```

**UI Update** (Users page):

```
┌────────────────────────────────────────────────────────────┐
│ Users                                      [+ Invite User]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ [Active Users (4)] [Inactive Users (1)]                    │
│                                                            │
│ Name         Email            Role       Last Login  Actions│
│ ──────────────────────────────────────────────────────────│
│ 👤 John Doe  john@example.com Inspector  2h ago     [Edit] │
│ 👤 Jane Smith jane@example.com Nurse     1d ago     [Edit] │
│ 👤 Bob Lee   bob@example.com  Inspector  3d ago     [Edit] │
│ 👤 Admin     admin@example.com Admin     Just now   [Edit] │
│                                                            │
│ ──────────── Inactive Users ────────────                   │
│ 🚫 Old User  old@example.com  Inspector  30d ago [Activate]│
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3.7 Activity Tracking

**Feature**: Track last login and last inspection completed.

**Implementation**:

**Update `last_login_at` on Login**:

```typescript
// lib/auth.ts (Better Auth config)
export const auth = betterAuth({
  // ... existing config
  hooks: {
    after: [
      {
        matcher: (context) => context.path === '/sign-in/email',
        handler: async (context) => {
          if (context.returned?.user?.id) {
            await db.query(
              `UPDATE profiles SET last_login_at = NOW() WHERE user_id = $1`,
              [context.returned.user.id]
            )
          }
        }
      }
    ]
  }
})
```

**Update `last_inspection_at` on Inspection Completion**:

```typescript
// lib/actions/inspections.ts
export async function completeInspection(inspectionId: string, status: string) {
  const { profile } = await requireRole(['inspector', 'nurse'])

  // Complete inspection
  await db.query(
    `UPDATE inspection_instances SET status = $1, completed_at = NOW() WHERE id = $2`,
    [status, inspectionId]
  )

  // Update last_inspection_at
  await db.query(
    `UPDATE profiles SET last_inspection_at = NOW() WHERE id = $1`,
    [profile.id]
  )

  revalidateTag('dashboard')
}
```

**Display Activity on Users Page**:

```
┌────────────────────────────────────────────────────────────┐
│ John Doe                                                   │
│ john@example.com • Inspector                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Last Login: 2 hours ago                                    │
│ Last Inspection: 1 day ago (Fire Extinguisher Check)       │
│                                                            │
│ Activity Summary (Last 30 Days):                           │
│ • 15 inspections completed                                 │
│ • 98% compliance rate                                      │
│ • 0 overdue inspections                                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Database Changes

### Migration: `006_user_management_enhancements.sql`

```sql
-- ============================================
-- INVITE CODES ENHANCEMENTS
-- ============================================

ALTER TABLE invite_codes
  ADD COLUMN is_permanent BOOLEAN DEFAULT FALSE;

-- Add index for faster invite lookup
CREATE INDEX idx_invite_codes_hash ON invite_codes(code_hash);

-- ============================================
-- PROFILE ENHANCEMENTS
-- ============================================

ALTER TABLE profiles
  ADD COLUMN phone TEXT,
  ADD COLUMN profile_photo_url TEXT,
  ADD COLUMN department TEXT,
  ADD COLUMN specialty TEXT,
  ADD COLUMN last_login_at TIMESTAMPTZ,
  ADD COLUMN last_inspection_at TIMESTAMPTZ,
  ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN deactivated_at TIMESTAMPTZ,
  ADD COLUMN deactivated_by UUID REFERENCES profiles(user_id),
  ADD COLUMN admin_notes TEXT,
  ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX idx_profiles_active ON profiles(is_active);
CREATE INDEX idx_profiles_last_login ON profiles(last_login_at DESC);
CREATE INDEX idx_profiles_role_active ON profiles(role, is_active);

-- Set existing users as active
UPDATE profiles SET is_active = TRUE WHERE is_active IS NULL;

-- ============================================
-- SUPABASE STORAGE SETUP
-- ============================================

-- Create profile-photos bucket (run via Supabase dashboard or SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for profile photos
CREATE POLICY "Users can upload their own profile photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
);

CREATE POLICY "Public read access to profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can update their own profile photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can delete their own profile photo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-photos');
```

---

## 5. API Endpoints

### New/Modified Endpoints

| Method | Path | Purpose | Auth Required |
|--------|------|---------|---------------|
| **POST** | `/api/invite-codes` | Generate new invite code | owner, admin |
| **PATCH** | `/api/invite-codes/[id]/refresh` | Extend expired invite | owner, admin |
| **GET** | `/api/invite-codes` | List all invite codes | owner, admin |
| **DELETE** | `/api/invite-codes/[id]` | Deactivate invite code | owner, admin |
| **POST** | `/api/users/bulk-import` | Import users from CSV | owner, admin |
| **GET** | `/api/users` | List all users | owner, admin |
| **GET** | `/api/users/[id]` | Get user details | owner, admin, self |
| **PATCH** | `/api/users/[id]` | Update user profile | owner, admin, self |
| **POST** | `/api/users/[id]/photo` | Upload profile photo | owner, admin, self |
| **POST** | `/api/users/[id]/deactivate` | Deactivate user | owner, admin |
| **POST** | `/api/users/[id]/activate` | Reactivate user | owner, admin |
| **POST** | `/api/users/[id]/reset-password` | Admin-initiated password reset | owner, admin |
| **POST** | `/api/auth/forgot-password` | Self-service password reset | public |
| **POST** | `/api/auth/reset-password` | Complete password reset | public |

---

## 6. UI Changes

### 6.1 Updated Users Page

**Route**: `/users`

**New Features**:
- Tabs: Active Users / Inactive Users
- Profile photos in list
- Last login timestamp
- Last inspection timestamp
- Activity summary on user detail panel
- Bulk import button
- Improved invite code management

**Layout**:

```
┌──────────────────────────────────────────────────────────────┐
│ Users                  [+ Invite User] [⬆ Bulk Import]       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ [Active Users (4)] [Inactive Users (1)] [Invite Codes (3)]   │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │     Name            Role      Last Login    Actions   │   │
│ │ ──────────────────────────────────────────────────── │   │
│ │ 👤  John Doe        Inspector  2h ago       [...More] │   │
│ │     john@example.com                                  │   │
│ │     Phone: 555-1234 • Dept: Life Safety               │   │
│ │                                                        │   │
│ │ 👤  Jane Smith      Nurse      1d ago       [...More] │   │
│ │     jane@example.com                                  │   │
│ │     Phone: 555-5678 • Dept: Infection Control         │   │
│ │                                                        │   │
│ │ 👤  Bob Lee         Inspector  3d ago       [...More] │   │
│ │     bob@example.com                                   │   │
│ │     Phone: 555-9012 • Dept: Environment               │   │
│ │                                                        │   │
│ │ 👤  Admin           Admin      Just now     [...More] │   │
│ │     admin@example.com                                 │   │
│ │     Phone: — • Dept: Administration                   │   │
│ │                                                        │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**User Detail Panel** (opens on click):

```
┌──────────────────────────────────────────────┐
│ John Doe                          [✕ Close]  │
├──────────────────────────────────────────────┤
│                                              │
│ 👤 [Profile Photo]                           │
│                                              │
│ Email: john@example.com                      │
│ Phone: 555-1234                              │
│ Role: Inspector                              │
│ Department: Life Safety                      │
│ Specialty: Fire Safety Inspector             │
│                                              │
│ ─────────────────────────────────────────    │
│                                              │
│ Account Status: Active ✓                     │
│ Last Login: 2 hours ago                      │
│ Last Inspection: 1 day ago                   │
│ Joined: Jan 15, 2026                         │
│                                              │
│ ─────────────────────────────────────────    │
│                                              │
│ Activity (Last 30 Days):                     │
│ • 15 inspections completed                   │
│ • 98% compliance rate                        │
│ • 0 overdue inspections                      │
│                                              │
│ ─────────────────────────────────────────    │
│                                              │
│ Admin Notes:                                 │
│ [Text area for private notes]                │
│                                              │
│ ─────────────────────────────────────────    │
│                                              │
│ [Edit Profile] [Reset Password] [Deactivate] │
│                                              │
└──────────────────────────────────────────────┘
```

### 6.2 Invite Code Management Tab

**Layout**:

```
┌──────────────────────────────────────────────────────────┐
│ Invite Codes                           [+ Generate Code] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Code      Role       Expires      Uses    Actions       │
│ ──────────────────────────────────────────────────────  │
│ ABC12345  Inspector  Expired      0/10   [Refresh]      │
│ XYZ98765  Nurse      Feb 14, 2026 3/10   [Copy] [...]   │
│ QWE45678  Admin      Never         1/∞    [Copy] [...]   │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ [More Actions: Deactivate, View Usage History]          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Generate Code Modal**:

```
┌─────────────────────────────────────────────────┐
│ Generate Invite Code                            │
├─────────────────────────────────────────────────┤
│                                                 │
│ Role: [Inspector ▼]                             │
│                                                 │
│ Expiration:                                     │
│ ( ) 7 days                                      │
│ ( ) 30 days                                     │
│ ( ) 1 year                                      │
│ (•) Never expire                                │
│                                                 │
│ Max Uses:                                       │
│ ( ) Single-use (1)                              │
│ ( ) Limited (10)                                │
│ (•) Unlimited                                   │
│                                                 │
│ ─────────────────────────────────────────────   │
│                                                 │
│ Preview:                                        │
│ https://app.example.com/sign-up?invite=ABC12345 │
│                                                 │
│ [Cancel] [Generate Code]                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.3 Bulk Import Modal

**Layout**:

```
┌─────────────────────────────────────────────────┐
│ Bulk User Import                     [✕ Close]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Step 1: Download CSV Template                   │
│ [📥 Download users_template.csv]                │
│                                                 │
│ ─────────────────────────────────────────────   │
│                                                 │
│ Step 2: Upload Completed CSV                    │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │                                         │   │
│ │   📄 Drag & drop CSV file here          │   │
│ │      or click to browse                 │   │
│ │                                         │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ─────────────────────────────────────────────   │
│                                                 │
│ Step 3: Review Users (3 found)                  │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Name       Email            Role        │   │
│ │ ───────────────────────────────────────│   │
│ │ ✓ John Doe  john@example.com Inspector │   │
│ │ ✓ Jane Smith jane@example.com Nurse    │   │
│ │ ✗ Bob Lee   invalid-email    Inspector │   │
│ │   Error: Invalid email format           │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ℹ️ Valid users will receive welcome emails      │
│    with temporary passwords.                    │
│                                                 │
│ [Cancel] [Import 2 Valid Users]                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 7. Migration Strategy

### Phase 1: Database & Auth (Week 1)

1. Run migration `006_user_management_enhancements.sql`
2. Set up Supabase Storage bucket for profile photos
3. Add Better Auth hooks for `last_login_at` tracking
4. Test invite code refresh logic with existing codes

### Phase 2: Profile Enhancements (Week 2)

1. Build profile photo upload component
2. Add phone/department fields to user edit form
3. Build onboarding flow (`/onboarding` page)
4. Update users page to show new fields

### Phase 3: Invite & Bulk Import (Week 3)

1. Update invite code generation UI (add permanent option)
2. Build invite code refresh button
3. Build bulk import modal with CSV upload
4. Build CSV parser and validation
5. Build welcome email template
6. Test bulk import with 10+ users

### Phase 4: Activity Tracking & Deactivation (Week 4)

1. Implement `last_inspection_at` tracking on inspection completion
2. Build user deactivation/reactivation endpoints
3. Add "Inactive Users" tab on users page
4. Build activity summary panel
5. Test deactivation (ensure user cannot log in, historical data preserved)

### Phase 5: Testing & Polish (Week 5)

1. End-to-end testing of all new features
2. Test edge cases (expired invites, duplicate emails, invalid CSV)
3. Performance testing with 50+ users
4. Write documentation for admins
5. User acceptance testing with owner/admin roles

---

## 8. Future Enhancements

1. **SSO/SAML Integration**: Allow enterprise customers to use their existing identity provider
2. **Two-Factor Authentication (2FA)**: Add TOTP-based 2FA for owner/admin roles
3. **User Groups**: Group inspectors by location or department for easier assignment
4. **Advanced Audit Log**: Track all user actions (login, profile changes, permission changes)
5. **Custom Roles**: Allow owner to create custom roles with granular permissions
6. **User Import from Active Directory**: Sync users from on-premise AD or Azure AD

---

## Summary

**Improvements**:
1. ✅ Permanent invite links (never expire)
2. ✅ Invite link regeneration (refresh expired codes)
3. ✅ Bulk user import (CSV upload)
4. ✅ Improved onboarding (welcome email, forced password change, checklist)
5. ✅ Profile enhancements (phone, photo, department, specialty)
6. ✅ User deactivation (soft delete with Better Auth ban)
7. ✅ Activity tracking (last login, last inspection)

**Database Changes**:
- `invite_codes`: Add `is_permanent` column
- `profiles`: Add phone, photo_url, department, specialty, last_login_at, last_inspection_at, is_active, deactivation fields, onboarding fields
- Supabase Storage: Create `profile-photos` bucket

**New Features**:
- Bulk import modal with CSV upload
- Invite code management tab with refresh button
- User detail panel with activity summary
- Onboarding checklist page
- Profile photo upload

**Implementation**: 5 weeks (database → profiles → invites → activity → testing).
