# PLAN_00_OVERVIEW.md

**Master Overview: Inspection App Major Overhaul**

**Project**: Summit Digestive Health Center Inspection & Forms Management System
**Status**: Planning Phase
**Last Updated**: 2026-02-07

---

## Executive Summary

### What We're Building

A comprehensive digital transformation of Summit Digestive Health Center's paper-based inspection and compliance documentation system. The overhaul extends the existing inspection tracking app with a full binder/form management system, Google Forms integration, workflow automation, enhanced analytics, and improved user management.

### Why This Matters

**Current Pain Points:**
- Paper binders scattered across 7 organizational units (40+ templates in General Forms, plus 6 specialty binders)
- Google Forms → Excel workflow creates data silos
- Limited visibility into compliance trends by inspector or binder category
- Manual reminder systems prone to human error
- Temporary invite codes create user management overhead

**Business Value:**
- Centralized compliance tracking across all documentation systems
- Real-time visibility into inspection status and trends
- Automated workflows reduce administrative burden
- Better audit trail for regulatory compliance
- Mobile-first design supports staff workflows

---

## Current State

### Existing Functionality

**Inspection System:**
- Template-based inspections with frequency rules (weekly/monthly/yearly/every_3_years)
- Instance generation via Vercel cron jobs
- Status workflow: pending → in_progress → passed/failed/void
- Digital signatures with selfie capture
- Event audit trail
- Email reminders via Resend
- Push notifications for mobile devices

**Access Control:**
- 4 roles: owner, admin, nurse, inspector
- Location-based access via `profile_locations` junction table
- Invite code system with expiry dates

**Data Model:**
- 15 database tables
- Location-scoped multi-tenancy
- Event sourcing pattern for audit trail

**Tech Stack:**
- Next.js 16 (App Router), React 19
- Better Auth for authentication
- Supabase Postgres (server-only access)
- Zod validation, shadcn/ui components
- Tailwind CSS v4, Lucide icons

### What's Missing

1. **No binder/form structure** - Physical binders not represented in app
2. **No Google Forms integration** - Staff still use external forms
3. **Manual workflows** - Limited automation beyond cron jobs
4. **Basic analytics** - No breakdown by inspector or binder category
5. **Temporary users** - Invite codes expire, no permanent account management
6. **Limited form UI** - No rich checklist item interface

---

## Target State

### After Overhaul

**Complete Compliance Platform:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Inspection App (Unified)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Legacy Inspections│  │  Binder System   │                │
│  │  (existing)      │  │   (NEW)          │                │
│  │                  │  │                  │                │
│  │ • Templates      │  │ • 7 Org Units    │                │
│  │ • Instances      │  │ • Form Templates │                │
│  │ • Signatures     │  │ • Checklist Items│                │
│  │ • Events         │  │ • Responses      │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                               │
│  ┌───────────────────────────────────────────────┐          │
│  │         Google Forms Sync (Bi-directional)     │          │
│  │  • Import existing responses                   │          │
│  │  • Export new submissions                      │          │
│  │  • Maintain Google Sheets as source of truth  │          │
│  └───────────────────────────────────────────────┘          │
│                                                               │
│  ┌───────────────────────────────────────────────┐          │
│  │         n8n Workflow Automation                │          │
│  │  • Scheduled instance generation               │          │
│  │  • Email alerts & reminders                    │          │
│  │  • Google Forms sync jobs                      │          │
│  │  • Custom workflow triggers                    │          │
│  └───────────────────────────────────────────────┘          │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Analytics       │  │ User Management  │                │
│  │  • By Inspector  │  │ • Permanent      │                │
│  │  • By Binder     │  │   Accounts       │                │
│  │  • Compliance %  │  │ • Refreshable    │                │
│  │  • Trend Charts  │  │   Invites        │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                               │
│  ┌───────────────────────────────────────────────┐          │
│  │        Enhanced Access Control                 │          │
│  │  • Binder-level permissions                    │          │
│  │  • Form editor roles                           │          │
│  │  • Response viewer roles                       │          │
│  └───────────────────────────────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Capabilities

| Feature | Current | Target |
|---------|---------|--------|
| **Documentation Types** | Inspections only | Inspections + Binder Forms |
| **Form Management** | N/A | 7 org units, 40+ templates |
| **Google Forms** | External | Bi-directional sync |
| **Automation** | Vercel cron | n8n workflows |
| **Analytics** | Basic totals | By inspector, by binder, trends |
| **User Accounts** | Temporary invites | Permanent + refreshable |
| **Form UI** | Simple text | Rich checklist modal |
| **Audit Trail** | Events only | Events + form responses |

---

## Feature Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION LAYERS                         │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: FOUNDATION (No dependencies)
┌──────────────────────────────────────────────────────────┐
│  PLAN_06: User Management                                 │
│  • Permanent accounts                                     │
│  • Refreshable invites                                    │
│  • No breaking changes to existing auth                   │
└──────────────────────────────────────────────────────────┘

LAYER 2: CORE DATA MODEL (Depends on Layer 1)
┌──────────────────────────────────────────────────────────┐
│  PLAN_01: Binder/Form System                             │
│  • New tables: binders, form_templates, form_items       │
│  • Extends profiles (PLAN_06)                            │
│  • Location-scoped like inspections                      │
└──────────────────────────────────────────────────────────┘
         │
         │ provides schema for
         ▼
┌──────────────────────────────────────────────────────────┐
│  PLAN_07: Form Responses UI                              │
│  • Modal for checklist items                             │
│  • Signature/selfie capture                              │
│  • Depends on PLAN_01 schema                             │
└──────────────────────────────────────────────────────────┘

LAYER 3: INTEGRATION (Depends on Layers 1 & 2)
┌──────────────────────────────────────────────────────────┐
│  PLAN_02: Google Forms Sync                              │
│  • Requires binder schema (PLAN_01)                      │
│  • May trigger n8n workflows (PLAN_03)                   │
└──────────────────────────────────────────────────────────┘
         │
         │ can be automated by
         ▼
┌──────────────────────────────────────────────────────────┐
│  PLAN_03: n8n Integration                                │
│  • Orchestrates Google Forms sync (PLAN_02)              │
│  • Sends alerts (uses existing notification system)      │
│  • Replaces/augments Vercel cron                         │
└──────────────────────────────────────────────────────────┘

LAYER 4: REFINEMENTS (Depends on all previous layers)
┌──────────────────────────────────────────────────────────┐
│  PLAN_04: Access Control Changes                         │
│  • New permissions for binders (PLAN_01)                 │
│  • Form editor/viewer roles                              │
│  • Builds on user management (PLAN_06)                   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  PLAN_05: Dashboard Charts                               │
│  • Inspector compliance (requires PLAN_01 + PLAN_07)     │
│  • Binder compliance (requires PLAN_01)                  │
│  • Uses existing inspection data + new form responses    │
└──────────────────────────────────────────────────────────┘

LEGEND:
┌─────┐
│     │ = Feature Plan
└─────┘
  │
  ▼    = Dependency (arrow points to dependent feature)
```

### Critical Path

```
PLAN_06 → PLAN_01 → PLAN_07 → PLAN_05
(Users)   (Schema)  (UI)      (Analytics)

PLAN_02 ←→ PLAN_03 (Can be parallel or integrated)
(Forms)    (n8n)

PLAN_04 (Can happen anytime after PLAN_01)
(Access)
```

---

## Implementation Phases

### Recommended Order with Rationale

#### Phase 1: Foundation (Weeks 1-2)
**Plans:** PLAN_06 (User Management)

**Why First:**
- Low risk: extends existing auth without breaking changes
- Provides stable user accounts for all subsequent features
- Can be deployed independently

**Deliverables:**
- Permanent user accounts with `is_temporary` flag
- Refreshable invite links
- User deactivation workflow
- Migration script for existing invite codes

---

#### Phase 2: Core Data Model (Weeks 3-5)
**Plans:** PLAN_01 (Binder/Form System)

**Why Second:**
- Establishes schema foundation for all new features
- Independent of Google Forms sync (can use manual data entry initially)
- Enables immediate value: staff can start tracking binder forms

**Deliverables:**
- 5 new tables: `binders`, `form_templates`, `form_items`, `form_responses`, `form_response_items`
- Seed data for 7 organizational units
- Admin UI for managing binders and form templates
- Basic form instance creation (manual)

---

#### Phase 3: Form Interface (Weeks 6-7)
**Plans:** PLAN_07 (Form Responses UI)

**Why Third:**
- Depends on PLAN_01 schema
- High user impact: improves daily workflow
- Can validate data model with real usage

**Deliverables:**
- Modal-based form response editor
- Checklist item rendering
- Signature/selfie capture integration
- Mobile-responsive design

---

#### Phase 4: Integration & Automation (Weeks 8-11)
**Plans:** PLAN_02 (Google Forms Sync), PLAN_03 (n8n Integration)

**Why Fourth:**
- Requires stable binder schema (PLAN_01)
- Can be implemented in parallel or integrated
- High complexity, benefits from stable foundation

**Option A: Sequential**
1. PLAN_02 first (manual sync scripts)
2. PLAN_03 second (automate sync)

**Option B: Integrated**
1. Build PLAN_03 n8n workflows
2. Implement PLAN_02 sync as n8n workflows

**Deliverables:**
- Google Forms API integration
- Bi-directional sync (import responses, export submissions)
- n8n workflows: reminders, alerts, scheduled tasks
- Monitoring dashboard for sync status

---

#### Phase 5: Refinements (Weeks 12-14)
**Plans:** PLAN_04 (Access Control), PLAN_05 (Dashboard Charts)

**Why Last:**
- PLAN_04: Requires understanding of actual usage patterns
- PLAN_05: Needs data from PLAN_01 + PLAN_07 to be meaningful
- Both are enhancements to existing features

**Deliverables:**
- Binder-level permissions
- Form editor/viewer roles
- Inspector compliance charts
- Binder compliance charts
- Trend analysis with date range filters

---

### Parallel vs. Sequential

**Can Be Parallelized:**
- PLAN_02 + PLAN_03 (if keeping sync logic outside n8n initially)
- PLAN_04 + PLAN_05 (independent refinements)

**Must Be Sequential:**
- PLAN_06 → PLAN_01 (user accounts needed for form assignments)
- PLAN_01 → PLAN_07 (UI needs schema)
- PLAN_01 → PLAN_02 (sync needs schema)
- PLAN_01 → PLAN_05 (charts need data)

---

## Risk Assessment

### High-Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **Breaking existing inspections** | CRITICAL | Medium | • Additive changes only<br>• No schema renames<br>• Comprehensive E2E tests<br>• Feature flags for rollout |
| **Google Forms sync data loss** | HIGH | Medium | • Read-only sync initially<br>• Manual approval for writes<br>• Backup Google Sheets<br>• Rollback procedure |
| **User confusion: 2 systems** | HIGH | High | • Clear UI distinction (Inspections vs. Forms)<br>• Training materials<br>• Gradual rollout by location |
| **Performance with 40+ templates** | MEDIUM | Low | • Pagination on list views<br>• Lazy loading forms<br>• Index optimization |
| **n8n reliability** | MEDIUM | Medium | • Fallback to Vercel cron<br>• Monitoring & alerting<br>• Manual trigger options |
| **Scope creep** | MEDIUM | High | • Strict plan adherence<br>• Separate backlog for v2 features<br>• Weekly scope reviews |

### Medium-Priority Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Role confusion (PLAN_04)** | MEDIUM | • User testing before deployment<br>• Role matrix documentation |
| **Chart performance (PLAN_05)** | LOW | • Pre-aggregated views<br>• Caching layer |
| **Mobile push notification changes** | MEDIUM | • Maintain existing push API<br>• Add new notification types carefully |

---

## Migration Strategy

### Guiding Principles

1. **Zero Downtime**: All changes must be backward-compatible
2. **Additive Only**: No deletions or renames to existing tables/columns
3. **Feature Flags**: New features behind flags for gradual rollout
4. **Parallel Systems**: Inspections and Forms coexist independently
5. **Audit Everything**: Track all migrations with event logs

### Phase-by-Phase Migration

#### PLAN_06: User Management
```sql
-- Migration: Add permanent user flags
ALTER TABLE profiles ADD COLUMN is_temporary BOOLEAN DEFAULT true;
ALTER TABLE invite_codes ADD COLUMN expires_at TIMESTAMPTZ;

-- Backfill: Mark all existing users as non-temporary
UPDATE profiles SET is_temporary = false WHERE created_at < NOW() - INTERVAL '7 days';
```

**Rollback:** Drop columns (data preserved in existing `profiles` table)

---

#### PLAN_01: Binder/Form System
```sql
-- Migration: Create new tables (no changes to existing schema)
CREATE TABLE binders (...);
CREATE TABLE form_templates (...);
CREATE TABLE form_items (...);
CREATE TABLE form_responses (...);
CREATE TABLE form_response_items (...);

-- Seed: Insert 7 organizational units
INSERT INTO binders (location_id, name, description, ...) VALUES ...;
```

**Rollback:** Drop new tables (existing inspections unaffected)

---

#### PLAN_07: Form Responses UI
- **No schema changes** (uses PLAN_01 tables)
- **Rollback:** Remove UI routes, keep data

---

#### PLAN_02 + PLAN_03: Integration
```sql
-- Migration: Add sync tracking
CREATE TABLE google_forms_sync_log (
  id UUID PRIMARY KEY,
  form_template_id UUID REFERENCES form_templates(id),
  google_form_id TEXT,
  sync_direction TEXT CHECK (sync_direction IN ('import', 'export')),
  synced_at TIMESTAMPTZ,
  status TEXT,
  error_message TEXT
);
```

**Rollback:** Drop sync tables, disable n8n workflows

---

#### PLAN_04: Access Control
```sql
-- Migration: Add permission columns
ALTER TABLE profiles ADD COLUMN binder_permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE binders ADD COLUMN restricted BOOLEAN DEFAULT false;
```

**Rollback:** Drop columns (falls back to role-based access)

---

#### PLAN_05: Dashboard Charts
- **No schema changes** (queries existing data)
- **Rollback:** Remove chart components

---

### Data Preservation Strategy

**Backup Before Each Phase:**
```bash
# Automated pre-migration backup
pg_dump $DATABASE_URL > backups/pre_plan_XX_$(date +%Y%m%d).sql
```

**Testing Protocol:**
1. Deploy to staging with full production data copy
2. Run E2E tests for existing features
3. Manual QA for new features
4. Load testing with 100+ concurrent users
5. Rollback test (must complete in < 5 minutes)

**Go/No-Go Criteria:**
- [ ] All existing E2E tests pass
- [ ] No performance regression (p95 latency < 500ms)
- [ ] Rollback verified in staging
- [ ] Training materials completed
- [ ] Stakeholder approval

---

## Cross-Feature Concerns

### Data Model Consistency

**All new tables must follow existing patterns:**

```typescript
// Common fields (matches inspection_instances)
{
  id: UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id: UUID REFERENCES locations(id), // Multi-tenancy
  created_at: TIMESTAMPTZ DEFAULT NOW(),
  updated_at: TIMESTAMPTZ DEFAULT NOW(),
  created_by_profile_id: UUID REFERENCES profiles(id),
  updated_by_profile_id: UUID REFERENCES profiles(id)
}
```

**Naming Conventions:**
- Tables: snake_case, plural (e.g., `form_templates`)
- Foreign keys: `{singular}_id` (e.g., `binder_id`)
- Junction tables: `{table1}_{table2}` (e.g., `profile_binders`)
- Timestamps: `{action}_at` (e.g., `completed_at`)

---

### Authentication & Authorization

**Existing Pattern (Must Maintain):**
```typescript
// Server-side auth check (Route Handler)
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const session = await auth.api.getSession({ headers: await headers() })
if (!session) return new Response("Unauthorized", { status: 401 })

const profile = await db.query.profiles.findFirst({
  where: eq(profiles.user_id, session.user.id)
})

// Location access check
const hasAccess = await db.query.profile_locations.findFirst({
  where: and(
    eq(profile_locations.profile_id, profile.id),
    eq(profile_locations.location_id, locationId)
  )
})
```

**New Features Must:**
- Use same session validation
- Respect location-based access
- Add role checks for new permissions (PLAN_04)

---

### API Patterns

**Existing Conventions:**
```
/api/locations/:locationId/inspections
/api/locations/:locationId/inspections/:instanceId
```

**New Endpoints (PLAN_01):**
```
/api/locations/:locationId/binders
/api/locations/:locationId/binders/:binderId/forms
/api/locations/:locationId/forms/:formId/responses
```

**Response Format (Standard):**
```typescript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Message" }
```

---

### Event Audit Trail

**Existing Pattern:**
```typescript
// inspection_events table
await db.insert(inspectionEvents).values({
  inspection_instance_id: instanceId,
  event_type: "status_changed", // or "signature_added", "assigned", etc.
  actor_profile_id: profile.id,
  payload: { old_status: "pending", new_status: "in_progress" }
})
```

**New Events (PLAN_01):**
```typescript
// form_events table (new)
event_type options:
- "form_created"
- "form_submitted"
- "form_updated"
- "form_signature_added"
- "google_forms_synced" (PLAN_02)
```

---

### UI Component Standards

**Existing Patterns (Must Match):**
- shadcn/ui components from `components/ui/`
- Tailwind CSS v4 utility classes
- Lucide icons only
- Mobile-first responsive design
- Dark mode support

**New Components (PLAN_07):**
```typescript
// Form response modal must follow inspection signature modal pattern
<Dialog>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Form: {formTemplate.name}</DialogTitle>
    </DialogHeader>
    {/* Checklist items */}
    {/* Signature capture */}
  </DialogContent>
</Dialog>
```

---

### Notification System

**Existing Channels:**
1. Email (Resend)
2. Web Push (push_subscriptions table)
3. In-app (notification_outbox table)

**New Notification Types (PLAN_02, PLAN_03):**
- "form_due_soon"
- "form_overdue"
- "google_forms_sync_failed"
- "binder_compliance_alert"

**Integration Points:**
- Vercel cron: `/api/cron/send-reminders`
- n8n webhooks: `/api/webhooks/n8n` (PLAN_03)

---

### Testing Requirements

**All features must include:**

1. **Unit tests** (Vitest)
   - Service functions
   - Validation schemas
   - Utility functions

2. **Integration tests**
   - API endpoints
   - Database queries
   - Auth middleware

3. **E2E tests** (Playwright)
   - Critical user flows
   - Mobile viewport
   - Cross-browser (Chrome, Safari)

4. **Performance tests**
   - Load testing (100+ concurrent users)
   - Query performance (<100ms for list views)
   - Bundle size (<300KB initial JS)

---

## Plan Index

| Plan | Title | Description | Dependencies |
|------|-------|-------------|--------------|
| **[PLAN_01](PLAN_01_BINDER_FORMS.md)** | Binder/Form System | Map physical binders to digital structure. 7 org units, 40+ templates, checklist items. | PLAN_06 |
| **[PLAN_02](PLAN_02_GOOGLE_FORMS.md)** | Google Forms Sync | Bi-directional sync with existing Google Forms and Sheets. Import responses, export submissions. | PLAN_01 |
| **[PLAN_03](PLAN_03_N8N.md)** | n8n Integration | Workflow automation: reminders, alerts, Google Forms sync, scheduled tasks. | PLAN_02 (optional) |
| **[PLAN_04](PLAN_04_ACCESS_CONTROL.md)** | Access Control Changes | Binder-level permissions, form editor/viewer roles, response access control. | PLAN_01 |
| **[PLAN_05](PLAN_05_ANALYTICS.md)** | Dashboard Charts | Compliance analytics by inspector, by binder, trend analysis with date range filters. | PLAN_01, PLAN_07 |
| **[PLAN_06](PLAN_06_USER_MANAGEMENT.md)** | User Management | Permanent accounts, refreshable invites, user deactivation workflow. | None |
| **[PLAN_07](PLAN_07_FORM_UI.md)** | Form Responses UI | Modal-based form editor with checklist items, signature/selfie capture. | PLAN_01 |

---

## Success Metrics

### Quantitative Goals

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **System Adoption** | N/A | 80% of forms digitized in 6 months | Form responses / total expected |
| **Time to Complete Form** | N/A | <5 minutes average | Timestamp diff: opened → submitted |
| **Compliance Rate** | ~65% (manual tracking) | >90% | Passed inspections + forms / total due |
| **User Satisfaction** | N/A | >4.5/5 | Post-rollout survey |
| **Mobile Usage** | ~40% | >70% | Device type in analytics |
| **Google Forms Dependency** | 100% | <20% | Forms submitted directly in app |

### Qualitative Goals

- [ ] Staff prefer webapp over paper binders
- [ ] Reduced time spent on compliance reporting
- [ ] Fewer missed inspections/forms due to automated reminders
- [ ] Easier audit preparation (digital records)
- [ ] Reduced administrative overhead for user management

---

## Appendix: Physical Binder Structure

### 7 Organizational Units

1. **General Forms** (40 templates)
   - Incident reports, equipment logs, maintenance requests, etc.

2. **Hand Hygiene Binder**
   - Hand hygiene audits, compliance tracking

3. **Montero Technical Binder**
   - Technical equipment checklists, calibration records

4. **Nursing Logs Binder**
   - Patient care logs, medication administration records

5. **Procedure Logs Binder**
   - Endoscopy procedure tracking, turnover times

6. **Scope Logs Binder**
   - Scope reprocessing logs, leak test records

7. **Yanling Clinical Binder**
   - Clinical quality metrics, infection control logs

### Google Forms Mapping

Each form template in physical binders has:
- Corresponding Google Form (for data collection)
- Google Sheet (for response storage)
- Excel export (for reporting)

Target: Replace this workflow with webapp form submission + optional Google Forms sync for legacy support.

---

**Document Version**: 1.0
**Next Review**: After Phase 1 completion
**Owner**: Development Team
**Stakeholders**: Summit Digestive Health Center Operations Team
