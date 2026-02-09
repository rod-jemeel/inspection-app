# Implementation Plans

**Project**: Summit Digestive Health Center Inspection & Forms Management System
**Status**: Planning Phase
**Last Updated**: 2026-02-07

---

## Overview

Comprehensive digital transformation of Summit Digestive Health Center's paper-based inspection and compliance documentation system. Extends the existing inspection tracking app with full binder/form management, Google Forms integration, workflow automation, enhanced analytics, and improved user management.

### Business Value

**Current Pain Points:**
- Paper binders scattered across 7 organizational units (52+ forms total)
- Google Forms → Excel workflow creates data silos
- Limited visibility into compliance trends by inspector or binder category
- Manual reminder systems prone to human error
- Temporary invite codes create user management overhead

**Target Benefits:**
- Centralized compliance tracking across all documentation systems
- Real-time visibility into inspection status and trends
- Automated workflows reduce administrative burden
- Better audit trail for regulatory compliance
- Mobile-first design supports staff workflows

### Phased Implementation

**Phase 1: Foundation (Weeks 1-2)**
PLAN_06: User Management - Permanent accounts, refreshable invites, user deactivation

**Phase 2: Core Data Model (Weeks 3-5)**
PLAN_01: Binder/Form System - Schema foundation, 7 org units, admin UI

**Phase 3: Form Interface (Weeks 6-7)**
PLAN_07: Form Responses UI - Modal-based editor, checklist items, signature/selfie

**Phase 4: Integration & Automation (Weeks 8-11)**
PLAN_02: Google Forms Sync + PLAN_03: n8n Integration - Bi-directional sync, automation workflows

**Phase 5: Refinements (Weeks 12-14)**
PLAN_04: Access Control + PLAN_05: Dashboard Charts - Permissions, analytics, compliance scoring

---

## Binder System

**Dependencies**: None (Foundation)
**Status**: Phases 1+2 Complete

### Schema Design

Transform flat `inspection_templates` into hierarchical Binder/Form/Field system matching physical documentation.

**New Tables:**
- `binders` - Top-level organizational units (7 units: Forms Folder, Hand Hygiene, Montero, Nursing Logs, Procedure Logs, Scope Logs, Yanling)
- `form_templates` - Individual forms within binders (52 templates total)
- `form_fields` - Checklist items/questions (773 fields across all forms)
- `form_responses` - Completed submissions
- `form_field_responses` - Individual field values
- `binder_assignments` - User-binder access control

**Field Types**: text, textarea, number, date, datetime, boolean, select, multi_select, signature, photo, selfie, temperature, pressure

**Key Features:**
- RLS policies for org-scoped access
- Inspection-form linking via `inspection_templates.binder_id` + `form_template_id`
- Form response tied to inspection instances via `inspection_instance_id`
- Binder-level access control (editors vs viewers)
- Permission flags on profiles (can_manage_binders, can_manage_forms, can_view_all_responses, can_export_reports, can_configure_integrations)

**Migration Strategy:**
1. Create new tables (no changes to existing schema)
2. Seed 7 organizational units
3. Create "Legacy Inspections" binder for existing templates
4. Migrate inspection_templates → form_templates
5. Create basic pass/fail field for legacy forms
6. Feature flag for gradual rollout

**API Endpoints:**
```
/api/locations/:locationId/binders
/api/locations/:locationId/binders/:binderId/forms
/api/locations/:locationId/forms/:formId/fields
/api/locations/:locationId/forms/:formId/responses
/api/locations/:locationId/binders/:binderId/assignments
```

**UI Components:**
- Binder list/detail pages with 5 tabs (Forms | Templates | Inspections | Responses | Assignments)
- Form template editor with field builder
- Response viewer with CSV/PDF export
- CRUD dialogs for binders and form templates
- Sidebar navigation with binder actions (create, edit, delete)

**Seed Data**: 7 binders, 51 form templates, 773 fields covering all DETAILED_DOCS

---

## Google Forms Sync

**Dependencies**: PLAN_01 (Binder System)
**Status**: Draft

### Hybrid Architecture (Recommended)

**n8n** for scheduled bulk operations (import, periodic sync)
**Direct API** for real-time operations (submit response, update field)
n8n as sync reconciliation layer running nightly

### Google APIs Required

**Forms API v1**: Read form structure (questions, options, validation)
**Sheets API v4**: Read/write response data from linked Excel files
**Drive API v3**: Enumerate forms/sheets in shared drive binders

**Authentication**: Service account with JSON key, shared on Google Drive binders

### Database Extensions

```sql
CREATE TABLE google_form_links (
  form_template_id UUID REFERENCES form_templates(id),
  google_form_id TEXT,
  google_sheet_id TEXT,
  field_mapping JSONB,  -- google_field_id → form_field_id
  sync_direction TEXT,   -- 'pull', 'push', 'bidirectional', 'disabled'
  sync_frequency_minutes INTEGER DEFAULT 60,
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE sync_log (
  google_form_link_id UUID,
  operation TEXT,  -- 'import', 'pull', 'push', 'structure_sync'
  direction TEXT,
  status TEXT,
  records_processed INTEGER,
  error_details JSONB
);

ALTER TABLE form_responses ADD COLUMN google_response_id TEXT UNIQUE;
ALTER TABLE form_responses ADD COLUMN synced_to_google BOOLEAN DEFAULT FALSE;
```

### Import Pipeline

**Phase 1: Discovery** - n8n workflow enumerates all Google Forms and linked response sheets (52 forms)

**Phase 2: Structure Import** - Parse form.items[] into form_fields, create form_template + google_form_links

**Phase 3: Response Import** - Read Google Sheets rows, map to form_responses + form_field_responses (10k+ historical responses)

**Phase 4: Ongoing Sync**
- **Pull** (hourly n8n cron): Read new Google Sheets rows since last_synced_at
- **Push** (webhook trigger): Append webapp submissions to Google Sheets (optional)
- **Conflict Resolution**: webapp_wins (recommended), google_wins, or manual

### Migration Timeline

**Week 1-2: Read-Only Import** - Import all 52 forms and responses, no ongoing sync yet

**Week 3-4: Bi-Directional Sync** - Enable hourly pull + real-time push for pilot forms

**Week 5-6: Webapp as Primary** - Staff submit via webapp, Google as backup only

**Month 3+: Google Deprecation** - Fully decouple from Google (optional)

**Rate Limits**: Forms API 30k/day, Sheets API 500 reads/100s/user, Drive API 20k/day

---

## n8n Workflow Automation

**Dependencies**: PLAN_02 (Google Forms Sync - optional)
**Status**: Draft

### Deployment Strategy

**Recommended**: Self-hosted Docker Compose on VPS (DigitalOcean/AWS EC2)
**Alternative**: n8n Cloud ($20-50/month, managed)

**Docker Compose**:
```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports: ["5678:5678"]
    environment:
      N8N_BASIC_AUTH_ACTIVE: true
      WEBHOOK_URL: https://n8n.yourdomain.com
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: ${DB_HOST}
```

### Core Workflows

**daily-reminders** (replaces `/api/cron/reminders`)
- Schedule: Daily 8 AM ET
- Query pending/in_progress instances due within reminder windows
- Categorize by type (overdue, due_today, upcoming, monthly_warning)
- Queue emails via `notification_outbox` + send push notifications
- Process outbox via Resend

**daily-instance-generation** (replaces `/api/cron/generate-instances`)
- Schedule: Daily midnight ET
- Query active templates, check existing instances
- Calculate due dates based on frequency
- Insert new instances + log events

**escalation-digest** (new)
- Schedule: Daily 9 AM ET
- Query overdue unassigned instances
- Send digest to OWNER_ESCALATION_EMAIL

**assignment-notification** (new)
- Trigger: Webhook on assignment change
- Queue notification + send push + immediate email

### Google Sync Workflows

**google-forms-pull-sync**
- Schedule: Every 15 minutes
- Fetch new rows from Google Sheets since last_synced_at
- Map to inspection_instances, upsert to Supabase
- Update sync timestamp

**google-forms-push-sync**
- Trigger: Webhook on inspection completion
- Transform to Google Sheets format
- Append row via Sheets API

**google-forms-import**
- Trigger: Manual webhook
- One-time bulk import of all historical data

### Webhook Integration

**Webapp → n8n**:
- `POST /webhook/assignment-changed`
- `POST /webhook/inspection-completed`
- `POST /webhook/import-google-forms`

**Authentication**: HMAC-SHA256 signature in `X-N8N-Signature` header

**n8n → Webapp**:
- Connect to Supabase Postgres directly (port 6543 connection pooler)
- Or use HTTP requests to webapp API endpoints

### Migration from Vercel Cron

**Phase 1: Shadow Mode (Week 1-2)** - Run n8n parallel to Vercel cron, validate outputs match

**Phase 2: n8n Takeover (Week 3)** - Disable Vercel cron, n8n becomes primary

**Phase 3: Cleanup (Week 4)** - Refactor cron endpoints to internal APIs, keep as fallback

**Rollback**: Re-enable Vercel cron via `vercel.json`, disable n8n workflows

---

## Access Control & Permissions

**Dependencies**: PLAN_01 (Binder System)
**Status**: Draft

### Current Role Matrix

| Role | Permissions |
|------|-------------|
| **owner** | Full system access, manage all users, templates, locations |
| **admin** | Manage non-owner users, templates, view all inspections |
| **nurse** | View assigned inspections, complete inspections |
| **inspector** | View assigned inspections, submit responses |

### Planned Enhancements

**Approach**: Role + Permission Flags (not full RBAC for MVP)

**Add to profiles table**:
```sql
ALTER TABLE profiles ADD COLUMN can_manage_binders BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN can_manage_forms BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN can_view_all_responses BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN can_export_reports BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN can_configure_integrations BOOLEAN DEFAULT FALSE;
```

**Default permissions by role**:
- owner: All permissions TRUE
- admin: All TRUE except can_configure_integrations
- nurse/inspector: All FALSE

**Binder-Level Access Control**:

```sql
CREATE TABLE binder_assignments (
  binder_id UUID REFERENCES binders(id),
  user_id UUID REFERENCES profiles(user_id),
  can_edit BOOLEAN DEFAULT FALSE,  -- Editor vs viewer
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Query pattern**: Owner/admin see all binders; nurses/inspectors only see assigned binders

**Authorization helpers** (`lib/server/auth-helpers.ts`):
```typescript
export async function requirePermission(permission: keyof Profile)
export async function requireBinderManagement()
export async function requireFormManagement()
export async function requireViewAllResponses()
export async function requireExportReports()
export async function requireIntegrationConfig()
```

**Client-side checks** (`lib/permissions.ts`):
```typescript
export function canManageBinders(profile: Profile | null): boolean
export function canManageForms(profile: Profile | null): boolean
export function canViewAllResponses(profile: Profile | null): boolean
export function canExportReports(profile: Profile | null): boolean
export function canConfigureIntegrations(profile: Profile | null): boolean
```

### Migration Strategy

**Phase 1 (Week 1)**: Add permission flags, update auth helpers, test with existing users

**Phase 2 (Week 2)**: Update API endpoints with specific permission checks

**Phase 3 (Week 3)**: Create binder_assignments table, build assignment UI, filter queries

**Phase 4 (Week 4)**: Update invite flow for new roles, document differences

**Backward Compatibility**: Existing users retain current access via migration script setting flags based on role

---

## Dashboard Analytics & Charts

**Dependencies**: PLAN_01 (Binder System), PLAN_04 (Access Control)
**Status**: Draft

### Current Dashboard

**Existing KPIs**: pending, overdue, passed, failed, dueThisWeek, complianceRate

**Existing Charts** (recharts):
- Weekly bar chart (inspections completed per week)
- Status pie chart (pending/passed/failed/void distribution)
- Compliance line chart (weekly compliance rate over time)
- Volume area chart (inspection volume over time)

### New Analytics

**By Inspector** (`/dashboard/inspectors` - Owner/Admin only):
- Compliance rate per inspector (horizontal bar chart, color-coded green/yellow/red)
- Workload distribution (stacked bar: pending/completed/overdue)
- Response time trends (line chart: avg days to complete over time)
- Inspector activity heatmap (GitHub-style calendar, use `react-calendar-heatmap`)

**By Binder** (`/dashboard/binders`):
- Compliance rate per binder (donut chart with drill-down)
- Overdue by binder (sortable table)
- Binder trends over time (multi-line chart, one per binder)
- Form completion rates (horizontal bar chart on drill-down)

**By Frequency**:
- On-time rate by frequency (radar chart: daily/weekly/monthly/quarterly/annual)
- Upcoming due by frequency (table with this week/this month columns)

**Trend Analysis**:
- Month-over-month compliance change (bar chart with +/- deltas)
- Seasonal patterns (line chart: avg volume per month across years)
- Failure trend (line chart with trend line)

**Regulatory Readiness Score** (new card on main dashboard):
```typescript
const score = (
  (complianceRate * 0.4) +
  ((1 - overdueRate) * 0.3) +
  (onTimeCompletionRate * 0.2) +
  (correctiveActionEffectiveness * 0.1)
) * 100
```
- Color-coded: 90-100 Green (Excellent), 80-89 Yellow (Good), 70-79 Orange (Needs Improvement), <70 Red (Critical)
- Breakdown shows each component score

### Performance Optimization

**Materialized Views** (refresh nightly at 2 AM):
```sql
CREATE MATERIALIZED VIEW inspector_performance AS
SELECT p.id, p.name,
  COUNT(*) as total_inspections,
  COUNT(*) FILTER (WHERE ii.status = 'passed') as passed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ii.status = 'passed') /
    NULLIF(COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')), 0), 2) as compliance_rate,
  AVG(EXTRACT(EPOCH FROM (ii.completed_at - ii.scheduled_date)) / 86400.0) as avg_response_days
FROM profiles p
LEFT JOIN inspection_instances ii ON ii.profile_id = p.id
WHERE p.role IN ('inspector', 'nurse')
  AND ii.scheduled_date > NOW() - INTERVAL '90 days'
GROUP BY p.id, p.name;

CREATE MATERIALIZED VIEW binder_compliance AS ...
```

**Caching Strategy**:
- Server-side: Next.js `unstable_cache` with 1 hour TTL
- Client-side: React Query with 5 min stale time
- Revalidate tags on inspection completion

**Dashboard Filters**: Date range (7/30/90/365 days, all time), binder, inspector (via nuqs URL state)

### Export Enhancements

**PDF Reports by Binder** - Compliance report with summary stats, form breakdown, recent failures (jspdf + jspdf-autotable)

**Compliance Certificates** - PDF certificate for passed inspections with logo, signature embed

**Regulatory Audit Export** - CSV/JSON export for date range (all inspection data structured for audits)

### Implementation Timeline

**Week 1**: Materialized views, caching, filter components, dependencies (react-calendar-heatmap, @tanstack/react-query)

**Week 2**: Inspector analytics page with 4 chart components

**Week 3**: Binder analytics page with donut chart + drill-down

**Week 4**: Regulatory readiness score, frequency charts, trend analysis, PDF generators

**Week 5**: Responsive testing, performance testing, error boundaries, user acceptance testing

---

## User Management & Invites

**Dependencies**: None (Foundation)
**Status**: Draft

### Current State

**Auth**: Better Auth email/password, 90-day sessions with daily refresh

**Invite System**: `invite_codes` table with code hash, role, expires_at, max_uses, used_count

**Current Limitations**:
- Codes expire without recovery
- No bulk user creation
- No self-service password reset
- Limited profile info (no phone, photo, department)
- No user deactivation (only delete, which loses history)
- No activity tracking (last login, last inspection)

### Planned Improvements

**1. Permanent Invite Links**
```sql
ALTER TABLE invite_codes ADD COLUMN is_permanent BOOLEAN DEFAULT FALSE;
```
- Admin can generate codes that never expire (or expire after 1 year)
- Options: 7 days, 30 days, 1 year, never expire
- Max uses: single-use, limited (10), unlimited

**2. Invite Link Regeneration**
- Refresh button extends expires_at by configurable days
- Keeps same code (no URL change)
- Optional: reset used_count to 0

**3. Bulk User Import**
- CSV upload with columns: name, email, role, phone, department
- Parser validates each row, creates users via Better Auth
- Generates temporary passwords, sends welcome emails
- Preview table before import confirmation
- Import results show success/error per user

**4. Improved Onboarding**
- Welcome email with temp password (from bulk import) OR invite link
- Force password change on first login if `must_change_password = true`
- Onboarding checklist: Set profile photo, Add phone, Review assigned binders, Watch tutorial
- Track completion with `onboarding_completed` flag

**5. Profile Enhancements**
```sql
ALTER TABLE profiles ADD COLUMN phone TEXT;
ALTER TABLE profiles ADD COLUMN profile_photo_url TEXT;
ALTER TABLE profiles ADD COLUMN department TEXT;
ALTER TABLE profiles ADD COLUMN specialty TEXT;
ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN last_inspection_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN deactivated_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN admin_notes TEXT;
ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
```

**Profile Photo Upload**: Supabase Storage bucket `profile-photos` (public read, authenticated write)

**6. User Deactivation (Soft Delete)**
- Set `is_active = false` + ban in Better Auth
- User cannot log in, but historical data preserved
- Separate "Active Users" / "Inactive Users" tabs
- Reactivation: unban + set is_active = true

**7. Activity Tracking**
- Update `last_login_at` via Better Auth hook on sign-in
- Update `last_inspection_at` on inspection completion
- Display activity summary on user detail panel (last 30 days: inspections completed, compliance rate)

### UI Updates

**Users Page** (`/users`):
- Tabs: Active Users (4) | Inactive Users (1) | Invite Codes (3)
- Profile photos in list
- Last login + last inspection timestamps
- User detail panel with activity summary, admin notes, permission flags
- Actions: Edit Profile, Reset Password, Deactivate

**Bulk Import Modal**:
- Step 1: Download CSV template
- Step 2: Upload completed CSV
- Step 3: Review users with validation (✓ valid, ✗ invalid with error)
- Import button creates users + sends welcome emails

**Invite Code Management Tab**:
- List with code, role, expires, uses, actions
- Generate Code modal with expiration + max uses options
- Refresh button for expired codes
- Copy/Deactivate actions

### API Endpoints

```
POST   /api/invite-codes                      # Generate new invite
PATCH  /api/invite-codes/[id]/refresh         # Extend expired invite
POST   /api/users/bulk-import                 # Import users from CSV
POST   /api/users/[id]/photo                  # Upload profile photo
POST   /api/users/[id]/deactivate             # Deactivate user
POST   /api/users/[id]/activate               # Reactivate user
POST   /api/users/[id]/reset-password         # Admin-initiated password reset
POST   /api/auth/forgot-password              # Self-service password reset
```

### Implementation Timeline

**Week 1**: Database migration, Supabase Storage bucket, Better Auth hooks for last_login_at

**Week 2**: Profile photo upload, phone/department fields, onboarding flow

**Week 3**: Invite code generation UI, refresh button, bulk import modal + CSV parser

**Week 4**: last_inspection_at tracking, deactivation/reactivation endpoints, inactive users tab, activity summary

**Week 5**: E2E testing, edge cases, performance testing, documentation

---

## Form Responses & Inspection UI

**Dependencies**: PLAN_01 (Binder System), PLAN_04 (Access Control)
**Status**: Draft

### Current Inspection Flow

**Existing**: Simple pass/fail status + free text remarks + signature canvas

**Limitations**:
- No structured checklist (just free text)
- No field validation (e.g., temperature ranges)
- No photo attachments for failed items
- No draft saving (must complete in one session)
- No auto-pass/fail logic
- No selfie capture for identity verification

### New Form-Based Flow

**Inspector Journey**:

1. **Open Inspection** → See form rendered dynamically from `form_fields` table

2. **Fill Form Fields** by type:
   - Checkbox: ✓ Pass / ✗ Fail
   - Number: Numeric input with unit (°F, PSI), real-time validation (green ✓ in range, red ⚠️ out of range)
   - Text/Textarea: Free text
   - Select: Dropdown (e.g., condition: Good/Fair/Poor)
   - Date/Datetime: Date picker
   - Photo: Camera/upload
   - Signature: Canvas pad
   - Selfie: Camera capture

3. **Save Draft** (optional) → `form_responses.status = 'draft'`, can return later

4. **Submit Form** → Validation runs (all required fields? values in range?)

5. **Auto-Pass/Fail Logic** evaluates responses:
   - If any critical field fails → inspection fails
   - If all fields pass → inspection passes
   - Result shown with reason

6. **Sign & Selfie**:
   - Draw signature on canvas
   - Capture selfie with camera (identity verification)
   - Submit → saves both as images in Supabase Storage

7. **View Submission** → Redirected to read-only view

**Progress Indicator**: Shows `████░░ 60% (3/5 required fields)`

**Critical Field Warning**: ⚠️ "This is a critical field. Failure will fail the entire inspection."

### Auto-Pass/Fail Logic

**Field Configuration**:
```sql
ALTER TABLE form_fields ADD COLUMN is_critical BOOLEAN DEFAULT FALSE;
ALTER TABLE form_fields ADD COLUMN validation_rules JSONB;
ALTER TABLE form_fields ADD COLUMN fail_on_value JSONB;
```

**Example fail_on_value**:
- Checkbox: `{"operator": "equals", "value": false, "reason": "Extinguisher must be present"}`
- Number: `{"operator": "out_of_range", "min": 100, "max": 150, "reason": "Pressure must be 100-150 PSI"}`
- Select: `{"operator": "in", "values": ["Poor", "Damaged"], "reason": "Condition unacceptable"}`

**Evaluation Algorithm** (`lib/actions/form-responses.ts`):
```typescript
export async function evaluateFormResponse(responseId: string): Promise<{
  overall_passed: boolean
  failed_fields: FieldEvaluation[]
  fail_reason?: string
}>
```
- Iterate all field responses
- Evaluate each against fail_on_value rules
- Flag failed fields in form_field_responses
- If any critical field fails → overall_passed = false
- Return fail_reason: "Critical field(s) failed: Extinguisher Present"

**Admin Configuration** (Field Editor UI):
- Toggle "Critical Field"
- Set validation rules (min/max, options, pattern)
- Set fail condition (operator + value)
- Customize error message

### Big Modal for Response Viewing

**Who can view**: Owner/Admin (all responses), Inspector/Nurse (own submissions only)

**Features**:
- Large modal (full-screen on mobile, 80% width desktop)
- Read-only view for submitted responses
- Editable view for draft responses
- Print-friendly layout (hides UI elements, page breaks, grayscale)
- PDF export button
- All field values with labels
- Failed fields highlighted in red with warning icon
- Signature and selfie displayed side-by-side
- Activity timeline (created, started, draft saved, submitted)

**Print Header** (added to print view):
```
[Company Logo]
INSPECTION REPORT - OFFICIAL RECORD
Report ID: INS-2026-02-07-001
Generated: Feb 7, 2026 at 10:15 AM
Page 1 of 2
```

### UI Components

**FormRenderer** (`components/inspections/form-renderer.tsx`):
- Dynamically render fields based on form_fields config
- Progress bar at top (sticky)
- Field validation in real-time
- Save Draft + Submit buttons (sticky bottom)

**FieldInput** (`components/inspections/field-input.tsx`):
- Switch on field.type to render appropriate input
- Boolean: RadioGroup (Pass ✓ / Fail ✗)
- Number: Input with unit display, validation feedback
- Select: shadcn Select component
- Photo: PhotoUpload component
- Handle validation_rules (min/max, required, pattern)

**ResponseModal** (`components/inspections/response-modal.tsx`):
- Dialog with max-w-4xl, scrollable
- Header with Print/PDF buttons
- Inspection details section
- FormRenderer (read-only mode)
- Verification section (signature + selfie images)
- Activity timeline

**SelfieCapture** (`components/inspections/selfie-capture.tsx`):
- Access camera via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })`
- Video preview → Capture button → Canvas with image → Retake/Submit
- Output base64 data URL

**PhotoUpload** (`components/inspections/photo-upload.tsx`):
- Camera capture OR file upload
- Multiple photos per field
- Upload to Supabase Storage `inspection-photos` bucket
- Display thumbnails with delete option

### Database Changes

```sql
CREATE TABLE form_responses (
  id UUID PRIMARY KEY,
  instance_id UUID REFERENCES inspection_instances(id),
  form_template_id UUID REFERENCES form_templates(id),
  submitted_by UUID REFERENCES profiles(user_id),
  status TEXT CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  signature_url TEXT,
  selfie_url TEXT,
  auto_fail_triggered BOOLEAN DEFAULT FALSE,
  fail_reason TEXT
);

CREATE TABLE form_field_responses (
  response_id UUID REFERENCES form_responses(id),
  field_id UUID REFERENCES form_fields(id),
  value JSONB,
  flagged BOOLEAN DEFAULT FALSE,  -- True if failed
  notes TEXT,
  photo_urls TEXT[]
);

-- Supabase Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', false);
```

### API Endpoints

```
GET    /api/inspections/[id]                           # Get with form fields
POST   /api/inspections/[id]/responses                 # Create/update draft
POST   /api/inspections/[id]/submit                    # Submit final response
GET    /api/inspections/[id]/responses/[responseId]    # Get submitted response
POST   /api/inspections/[id]/selfie                    # Upload selfie
POST   /api/inspections/[id]/field-photo               # Upload field photo
```

### Implementation Timeline

**Week 1**: Database migration, Supabase Storage bucket, evaluateFormResponse() function, unit tests

**Week 2**: FormRenderer, FieldInput (all types), PhotoUpload, draft saving

**Week 3**: Submission modal with signature + selfie, SelfieCapture component, submit endpoint, auto-fail integration

**Week 4**: ResponseModal, print CSS, PDF export, integrate into dashboard

**Week 5**: Field editor for validation rules, critical field toggle, E2E testing, performance testing (50+ fields)

---

## Success Metrics

**Quantitative Goals**:
- System adoption: 80% of forms digitized in 6 months
- Time to complete form: <5 minutes average
- Compliance rate: >90% (passed inspections + forms / total due)
- User satisfaction: >4.5/5 (post-rollout survey)
- Mobile usage: >70%
- Google Forms dependency: <20% (forms submitted directly in app)

**Qualitative Goals**:
- Staff prefer webapp over paper binders
- Reduced time on compliance reporting
- Fewer missed inspections via automated reminders
- Easier audit preparation (digital records)
- Reduced admin overhead for user management

**KPIs to Track** (post-migration):
- n8n reliability: 99.5% workflow success rate
- Reminder latency: Sent within 5 minutes of schedule
- Email/push delivery: <1% failure rate
- Google Sheets sync: 100% consistency
- n8n downtime: <1 hour/month

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing inspections | CRITICAL | Additive changes only, no schema renames, E2E tests, feature flags |
| Google Forms sync data loss | HIGH | Read-only sync initially, manual approval for writes, backup Google Sheets |
| User confusion (2 systems) | HIGH | Clear UI distinction, training materials, gradual rollout |
| Performance (50+ templates) | MEDIUM | Pagination, lazy loading, index optimization |
| n8n reliability | MEDIUM | Fallback to Vercel cron, monitoring, manual triggers |
| Scope creep | MEDIUM | Strict plan adherence, separate v2 backlog |
| n8n downtime | HIGH | Keep Vercel cron as fallback (re-enable in 5 min) |
| Google API rate limits | LOW | Exponential backoff, cache responses |
| Invite code bypass | MEDIUM | HMAC-SHA256, rotate secret monthly |

---

## Appendix: Binder Structure

### 7 Organizational Units

1. **Forms Folder** (3 forms from master templates)
2. **Hand Hygiene Binder** (1 form: WHO 5 Moments observation)
3. **Montero Technical Binder** (17 forms: equipment checklists, calibration)
4. **Nursing Logs Binder** (13 forms: controlled substances, crash cart, CLIA QC)
5. **Procedure Logs Binder** (2 forms: room cleaning, oxygen supply)
6. **Scope Logs Binder** (5 forms: manual cleaning, AER cycle, storage)
7. **Yanling Clinical Binder** (10 forms: adverse events, environmental monitoring, peer review)

**Total**: 51 form templates, 773 fields across all binders

### Google Forms Mapping

Each form template has:
- Corresponding Google Form (data collection)
- Google Sheet (response storage)
- Excel export (reporting)

**Target**: Replace with webapp submission + optional Google Forms sync for legacy support

---

**Document Version**: 1.0
**Next Review**: After Phase 1 completion
**Owner**: Development Team
**Stakeholders**: Summit Digestive Health Center Operations Team
