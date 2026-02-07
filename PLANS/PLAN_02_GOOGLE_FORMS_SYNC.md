# PLAN_02: Google Forms Integration & Sync

**Status**: Draft
**Created**: 2026-02-07
**Target**: Summit Digestive inspection-app

## Executive Summary

Summit Digestive currently uses Google Forms for all data collection with responses auto-populating Excel files organized in Google Drive binders. This plan outlines the integration strategy to:
1. Import existing form structures and historical responses
2. Enable bi-directional sync between webapp and Google ecosystem
3. Maintain legacy Google Forms compatibility during transition
4. Eventually migrate to webapp as primary system

## 1. Architecture Decision

### Option A: Direct Google API Integration

**Approach**: Next.js app directly calls Google APIs (Forms, Sheets, Drive)

**Pros**:
- No middleware dependencies
- Real-time sync control
- Simpler debugging (fewer moving parts)
- Lower infrastructure cost

**Cons**:
- Complex OAuth flows in Next.js
- API client code burden in webapp
- Harder to retry failed syncs
- No built-in workflow orchestration
- Google API quota management in app code

### Option B: Pure n8n Middleware

**Approach**: All Google interactions via n8n workflows; webapp only calls n8n webhooks

**Pros**:
- Visual workflow management
- Built-in retry/error handling
- Easy to add new sync directions
- Can orchestrate complex multi-API flows
- Non-technical users can modify workflows (with training)

**Cons**:
- Additional infrastructure (n8n deployment)
- Latency for real-time operations
- Debugging across two systems
- n8n becomes critical dependency
- Harder to version-control workflows (n8n uses JSON exports)

### Option C: Hybrid (RECOMMENDED)

**Approach**:
- **n8n** for scheduled bulk operations (import, periodic sync)
- **Direct API** for real-time operations (submit new response, update form field)
- n8n as "sync reconciliation layer" that runs nightly to catch any missed updates

**Pros**:
- Best of both worlds: real-time UX + robust batch processing
- n8n handles complex orchestration (enumerate 52 forms, paginated responses)
- Direct API enables instant feedback on submissions
- Graceful degradation: if n8n is down, real-time still works
- Clear separation: n8n = batch/recovery, webapp = transactional

**Cons**:
- Maintain both API clients and n8n workflows
- More complex architecture diagram
- Two places to implement business logic (though minimal overlap)

**Decision**: **Option C (Hybrid)**

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     GOOGLE ECOSYSTEM                            │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Google Forms │───>│ Google Sheets│───>│ Google Drive    │   │
│  │  (~52 forms) │    │ (response.xlsx)   │ (Binders)       │   │
│  └──────────────┘    └──────────────┘    └─────────────────┘   │
└───────────┬────────────────────┬──────────────────────────────┘
            │                    │
            │ Forms API v1       │ Sheets API v4
            │ (structure)        │ (responses)
            │                    │
     ┌──────▼────────────────────▼─────────┐
     │         n8n WORKFLOWS               │ Scheduled (hourly/daily)
     │  - google-forms-import-all          │ Batch operations
     │  - google-forms-sync-pull           │ Recovery/reconciliation
     │  - google-forms-structure-sync      │
     └──────┬──────────────────────────────┘
            │
            │ Webhook POST /sync/callback
            │
     ┌──────▼──────────────────────────────┐
     │    INSPECTION-APP (Next.js)         │
     │  ┌──────────────────────────────┐   │
     │  │ /api/sync/google/*           │   │ Direct API calls for:
     │  │  - import (trigger n8n)      │◄──┤ - Real-time submission
     │  │  - status                    │   │ - Form field updates
     │  │  - config                    │   │
     │  └────────┬─────────────────────┘   │
     │           │                          │
     │  ┌────────▼─────────────────────┐   │
     │  │ Supabase Postgres            │   │
     │  │  - form_templates            │   │
     │  │  - form_fields               │   │
     │  │  - form_responses            │   │
     │  │  - google_form_links         │   │
     │  │  - sync_log                  │   │
     │  └──────────────────────────────┘   │
     └─────────────────────────────────────┘
```

## 2. Google APIs Required

### 2.1 Google Forms API v1

**Purpose**: Read form structure (questions, options, validation rules)

**Key Endpoints**:
```
GET https://forms.googleapis.com/v1/forms/{formId}
  → Returns form title, description, items (questions)

PUT https://forms.googleapis.com/v1/forms/{formId}
  → Update form structure (add/remove questions)

POST https://forms.googleapis.com/v1/forms
  → Create new form (future: when webapp creates forms)
```

**Scopes**:
- `https://www.googleapis.com/auth/forms.body.readonly` (read structure)
- `https://www.googleapis.com/auth/forms.body` (modify structure)

**Notes**:
- Forms API does NOT provide responses (use Sheets API)
- Field IDs are stable UUIDs - safe to store in `google_form_links`

### 2.2 Google Sheets API v4

**Purpose**: Read/write response data from linked Excel files

**Key Endpoints**:
```
GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}
  → Read response rows (e.g., "Form Responses 1!A2:Z1000")

POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}:append
  → Append new response row (for webapp → Google push)

GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}
  → Get metadata (sheet names, column headers)
```

**Scopes**:
- `https://www.googleapis.com/auth/spreadsheets.readonly` (read responses)
- `https://www.googleapis.com/auth/spreadsheets` (write responses)

**Response Sheet Structure** (typical):
```
| Timestamp           | Date       | Inspector Name | Question1 | Question2 | ... |
|---------------------|------------|----------------|-----------|-----------|-----|
| 1/15/2026 10:23:45 | 01/15/2026 | Jane Smith     | Yes       | 72°F      | ... |
```

### 2.3 Google Drive API v3

**Purpose**: Enumerate forms/sheets in shared drive binders, handle file permissions

**Key Endpoints**:
```
GET https://www.googleapis.com/drive/v3/files?q={query}
  → List files in folder (e.g., "mimeType='application/vnd.google-apps.form'")

GET https://www.googleapis.com/drive/v3/files/{fileId}
  → Get file metadata (name, parent folder, owners)
```

**Scopes**:
- `https://www.googleapis.com/auth/drive.readonly` (list files)
- `https://www.googleapis.com/auth/drive.file` (create/move files)

**Example Query**:
```javascript
// Find all Google Forms in "Daily Inspections" folder
const query = `
  mimeType='application/vnd.google-apps.form' AND
  '${FOLDER_ID}' in parents AND
  trashed=false
`
```

### 2.4 Authentication Strategy

**Service Account (RECOMMENDED)**:
1. Create service account in Google Cloud Console
2. Generate JSON key file
3. Share Google Drive binders with service account email (`xyz@project.iam.gserviceaccount.com`)
4. Grant "Editor" role to allow read/write on forms and sheets

**Why Service Account**:
- No user OAuth flow required
- Works in server-side code (Next.js Route Handlers, n8n)
- Persistent access (no token refresh headaches)
- Suitable for automated sync workflows

**Setup**:
```bash
# Store JSON key in environment variable (base64 encoded)
GOOGLE_SERVICE_ACCOUNT_KEY=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsC...

# Or store in Supabase secrets for n8n to read
```

**Client Initialization** (Node.js):
```typescript
import { google } from 'googleapis'

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
  scopes: [
    'https://www.googleapis.com/auth/forms.body',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
})

const forms = google.forms({ version: 'v1', auth })
const sheets = google.sheets({ version: 'v4', auth })
const drive = google.drive({ version: 'v3', auth })
```

## 3. Database Schema Extensions

### 3.1 New Tables

```sql
-- Links form templates to Google Form IDs
CREATE TABLE google_form_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,

  -- Google IDs
  google_form_id TEXT NOT NULL, -- e.g., "1FAIpQLSdXYZ..."
  google_sheet_id TEXT, -- Linked response sheet (if auto-created by Google)
  google_drive_folder_id TEXT, -- Parent folder (binder) ID

  -- Field mapping: google_field_id → form_field_id
  field_mapping JSONB NOT NULL DEFAULT '{}',
  -- Example: {"entry.123456": "uuid-abc", "entry.789012": "uuid-def"}

  -- Sync configuration
  sync_direction TEXT NOT NULL DEFAULT 'pull', -- 'pull', 'push', 'bidirectional', 'disabled'
  sync_frequency_minutes INTEGER DEFAULT 60, -- How often n8n pulls
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT, -- 'success', 'error', 'in_progress'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(org_id, google_form_id),
  CHECK(sync_direction IN ('pull', 'push', 'bidirectional', 'disabled'))
)

-- Sync operation log
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_form_link_id UUID REFERENCES google_form_links(id) ON DELETE SET NULL,

  operation TEXT NOT NULL, -- 'import', 'pull', 'push', 'structure_sync'
  direction TEXT NOT NULL, -- 'google_to_webapp', 'webapp_to_google', 'bidirectional'

  status TEXT NOT NULL, -- 'success', 'error', 'partial'
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  error_details JSONB, -- Stack trace, API error codes
  metadata JSONB, -- Additional context (e.g., date range synced)

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  CHECK(operation IN ('import', 'pull', 'push', 'structure_sync')),
  CHECK(status IN ('success', 'error', 'partial'))
)

CREATE INDEX idx_sync_log_org ON sync_log(org_id, started_at DESC)
CREATE INDEX idx_sync_log_link ON sync_log(google_form_link_id, started_at DESC)

-- Global sync configuration
CREATE TABLE sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- n8n webhook URLs
  n8n_import_webhook TEXT,
  n8n_pull_webhook TEXT,
  n8n_push_webhook TEXT,

  -- Global settings
  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  conflict_resolution TEXT DEFAULT 'webapp_wins', -- 'webapp_wins', 'google_wins', 'manual'

  -- Notifications
  notify_on_sync_error BOOLEAN DEFAULT TRUE,
  notification_email TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(org_id),
  CHECK(conflict_resolution IN ('webapp_wins', 'google_wins', 'manual'))
)
```

### 3.2 Schema Changes to Existing Tables

**Add columns to `form_responses`**:
```sql
ALTER TABLE form_responses
ADD COLUMN google_response_id TEXT UNIQUE, -- From Sheets row ID or Form response ID
ADD COLUMN synced_to_google BOOLEAN DEFAULT FALSE,
ADD COLUMN last_synced_at TIMESTAMPTZ

CREATE INDEX idx_form_responses_google_id ON form_responses(google_response_id)
```

**Add columns to `form_fields`**:
```sql
ALTER TABLE form_fields
ADD COLUMN google_field_id TEXT, -- e.g., "entry.123456789"
ADD COLUMN google_field_type TEXT -- 'TEXT', 'CHOICE', 'CHECKBOX', 'DATE', etc.

CREATE INDEX idx_form_fields_google_id ON form_fields(google_field_id)
```

## 4. Import Pipeline (Initial Data Migration)

### 4.1 Discovery Phase

**Goal**: Enumerate all Google Forms and their linked response sheets

**n8n Workflow**: `google-forms-discovery`

```
┌─────────────────────────────────────────────────────────────┐
│ 1. List all folders in shared drive (binders)              │
│    → Drive API: list folders matching "Binder *"           │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. For each binder folder:                                  │
│    → List Google Forms in folder                           │
│    → Store: {form_id, form_name, folder_id, folder_name}   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. For each form:                                           │
│    → Forms API: GET /v1/forms/{formId}                      │
│    → Extract linked sheet ID (form.linkedSheetId)          │
│    → Store: {form_id, sheet_id, questions[]}               │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Save discovery results to JSON                          │
│    → POST to /api/sync/google/discovery-complete           │
│    → Webapp stores in sync_log for review                  │
└─────────────────────────────────────────────────────────────┘
```

**Expected Output** (JSON payload to webapp):
```json
{
  "discovered_at": "2026-02-07T10:00:00Z",
  "binders": [
    {
      "folder_id": "1ABC...",
      "folder_name": "Binder 01 - Daily Inspections",
      "forms": [
        {
          "form_id": "1FAIpQLSd...",
          "form_name": "Daily Equipment Check",
          "linked_sheet_id": "1XYZ...",
          "question_count": 12,
          "questions": [...]
        }
      ]
    }
  ],
  "total_forms": 52,
  "total_binders": 8
}
```

### 4.2 Structure Import Phase

**Goal**: Create `form_templates` and `form_fields` from Google Form definitions

**Webapp Endpoint**: `POST /api/sync/google/import-structure`

**Request Body**:
```json
{
  "google_form_id": "1FAIpQLSd...",
  "schedule_name": "Daily Equipment Check",
  "category": "equipment"
}
```

**Process**:
1. Call Forms API to get form structure
2. Parse form.items[] (questions) into `form_fields`
3. Map Google field types to webapp field types:
   ```typescript
   const FIELD_TYPE_MAP = {
     'TEXT': 'text',
     'PARAGRAPH_TEXT': 'textarea',
     'MULTIPLE_CHOICE': 'radio',
     'CHECKBOX': 'checkbox',
     'DATE': 'date',
     'TIME': 'time',
     'SCALE': 'number',
   }
   ```
4. Create `form_template` record
5. Create `form_fields` records with `google_field_id` stored
6. Create `google_form_links` record with `field_mapping` populated
7. Return created template ID

**Code Snippet** (lib/sync/import-form-structure.ts):
```typescript
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

export async function importFormStructure(googleFormId: string, orgId: string) {
  const auth = getGoogleAuth()
  const forms = google.forms({ version: 'v1', auth })

  // 1. Fetch form from Google
  const { data: form } = await forms.forms.get({ formId: googleFormId })

  // 2. Create form_template
  const supabase = await createClient()
  const { data: template, error } = await supabase
    .from('form_templates')
    .insert({
      org_id: orgId,
      name: form.info?.title || 'Untitled Form',
      description: form.info?.description,
      category: 'equipment', // TODO: infer from folder name
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error

  // 3. Create form_fields
  const fieldMapping: Record<string, string> = {}

  for (const item of form.items || []) {
    if (!item.questionItem) continue // Skip non-question items

    const question = item.questionItem.question
    const googleFieldId = `entry.${item.itemId}` // Google uses entry.XXX format

    const { data: field } = await supabase
      .from('form_fields')
      .insert({
        form_template_id: template.id,
        label: item.title || 'Untitled Question',
        field_type: mapGoogleFieldType(question),
        is_required: question?.required || false,
        display_order: item.itemId ? parseInt(item.itemId) : 0,
        google_field_id: googleFieldId,
        google_field_type: question?.__typename,
        // Store options for choice fields
        options: question?.choiceQuestion?.options?.map(o => o.value),
      })
      .select()
      .single()

    fieldMapping[googleFieldId] = field.id
  }

  // 4. Create google_form_links
  await supabase.from('google_form_links').insert({
    org_id: orgId,
    form_template_id: template.id,
    google_form_id: googleFormId,
    google_sheet_id: form.linkedSheetId,
    field_mapping: fieldMapping,
    sync_direction: 'pull', // Start with pull-only
    sync_frequency_minutes: 60,
  })

  return { template_id: template.id, fields_imported: Object.keys(fieldMapping).length }
}

function mapGoogleFieldType(question: any): string {
  if (question?.textQuestion) return 'text'
  if (question?.choiceQuestion) {
    return question.choiceQuestion.type === 'RADIO' ? 'radio' : 'checkbox'
  }
  if (question?.dateQuestion) return 'date'
  if (question?.timeQuestion) return 'time'
  if (question?.scaleQuestion) return 'number'
  return 'text' // fallback
}
```

### 4.3 Response Import Phase

**Goal**: Import historical responses from Google Sheets

**n8n Workflow**: `google-sheets-import-responses`

**Inputs**:
- `google_sheet_id` (from google_form_links.google_sheet_id)
- `form_template_id` (from google_form_links.form_template_id)

**Process**:
```
┌──────────────────────────────────────────────────────────────┐
│ 1. Sheets API: GET spreadsheet metadata                     │
│    → Identify "Form Responses 1" sheet                      │
│    → Read header row (A1:Z1) to map columns to field IDs    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Sheets API: GET all rows (A2:Z10000)                     │
│    → Paginate if >10k responses                             │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. For each row:                                             │
│    → Parse Timestamp, Date, Inspector Name                  │
│    → Map column values to form_field_ids using field_mapping│
│    → POST to /api/sync/google/import-response               │
└──────────────────────────────────────────────────────────────┘
```

**Webapp Endpoint**: `POST /api/sync/google/import-response`

**Request Body**:
```json
{
  "form_template_id": "uuid-abc",
  "google_response_id": "row_123", // Sheets row number or unique ID
  "submitted_by_email": "jane.smith@summitdigestive.com",
  "submitted_at": "2026-01-15T10:23:45Z",
  "field_values": {
    "uuid-field1": "Yes",
    "uuid-field2": "72°F",
    "uuid-field3": ["Item A", "Item B"]
  }
}
```

**Handler** (app/api/sync/google/import-response/route.ts):
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json()
  const { form_template_id, google_response_id, submitted_at, field_values } = body

  const supabase = await createClient()

  // Check for duplicate (idempotency)
  const { data: existing } = await supabase
    .from('form_responses')
    .select('id')
    .eq('google_response_id', google_response_id)
    .single()

  if (existing) {
    return NextResponse.json({ status: 'skipped', reason: 'already_imported' })
  }

  // Create form_response
  const { data: response, error } = await supabase
    .from('form_responses')
    .insert({
      form_template_id,
      submitted_by: body.submitted_by_email, // TODO: map to user_id
      submitted_at: new Date(submitted_at),
      status: 'completed',
      google_response_id,
      synced_to_google: true,
      last_synced_at: new Date(),
    })
    .select()
    .single()

  if (error) throw error

  // Create form_field_responses
  for (const [field_id, value] of Object.entries(field_values)) {
    await supabase.from('form_field_responses').insert({
      response_id: response.id,
      form_field_id: field_id,
      value: Array.isArray(value) ? value.join(', ') : String(value),
    })
  }

  return NextResponse.json({ status: 'imported', response_id: response.id })
}
```

### 4.4 Bulk Import Orchestration

**Manual Trigger**: Admin clicks "Import All Forms" button in webapp

**Webapp**: `POST /api/sync/google/import-all`

**Process**:
1. Webapp triggers n8n webhook (n8n_import_webhook from sync_config)
2. n8n runs discovery → structure import → response import for all 52 forms
3. n8n posts progress updates to `/api/sync/import-progress`
4. Webapp displays real-time progress (e.g., "Imported 15/52 forms...")
5. On completion, n8n posts final summary to `/api/sync/import-complete`

**Expected Timeline**:
- Discovery: ~2 minutes (52 forms × 2 API calls each)
- Structure import: ~10 minutes (create DB records for 52 forms × avg 15 fields)
- Response import: ~30-60 minutes (depends on total response count, estimate 10k+ responses)
- **Total**: ~1 hour for full migration

## 5. Ongoing Sync Strategies

### 5.1 Pull Sync (Google → Webapp)

**Trigger**: n8n scheduled workflow (hourly)

**Workflow**: `google-forms-sync-pull`

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Query sync_config for org with auto_sync_enabled=true    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. For each google_form_link with sync_direction IN         │
│    ('pull', 'bidirectional'):                               │
│    → Get last_synced_at timestamp                           │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Sheets API: Read rows where Timestamp > last_synced_at   │
│    → Use QUERY formula or read all + filter in code         │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. For each new row:                                         │
│    → POST /api/sync/google/import-response                  │
│    → Update sync_log with record count                      │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Update google_form_links.last_synced_at                  │
└──────────────────────────────────────────────────────────────┘
```

**Incremental Read** (code snippet):
```typescript
// In n8n or webapp helper
async function getNewResponses(sheetId: string, lastSyncedAt: Date) {
  const sheets = getGoogleSheetsClient()

  // Read all rows (Sheets API doesn't support WHERE filters)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Form Responses 1!A2:Z10000', // Adjust range as needed
  })

  const rows = response.data.values || []
  const headers = await getHeaderRow(sheetId) // ["Timestamp", "Date", ...]

  // Filter rows by timestamp
  const timestampIndex = headers.indexOf('Timestamp')
  const newRows = rows.filter(row => {
    const timestamp = new Date(row[timestampIndex])
    return timestamp > lastSyncedAt
  })

  return newRows.map(row => parseRowToResponse(row, headers))
}
```

### 5.2 Push Sync (Webapp → Google)

**Trigger**: User submits form in webapp

**Process**:
1. Webapp saves response to Supabase (primary storage)
2. Webapp checks `google_form_links.sync_direction` for this form
3. If `push` or `bidirectional`:
   - Call n8n webhook: `POST {n8n_push_webhook}` with response data
   - n8n appends row to Google Sheet using Sheets API
   - n8n calls back `/api/sync/google/push-complete` with status
   - Webapp updates `form_responses.synced_to_google = true`

**Async Pattern** (non-blocking):
```typescript
// app/api/forms/submit/route.ts
import { after } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const supabase = await createClient()

  // 1. Save to DB immediately
  const { data: response } = await supabase
    .from('form_responses')
    .insert({ ...body })
    .select()
    .single()

  // 2. Push to Google asynchronously (non-blocking)
  after(async () => {
    await pushToGoogleSheet(response.id)
  })

  // 3. Return success to user immediately
  return NextResponse.json({ id: response.id }, { status: 201 })
}

async function pushToGoogleSheet(responseId: string) {
  const supabase = await createClient()

  // Fetch response + linked form
  const { data } = await supabase
    .from('form_responses')
    .select(`
      *,
      form_template!inner(
        id,
        google_form_links(google_sheet_id, sync_direction, field_mapping)
      ),
      form_field_responses(form_field_id, value)
    `)
    .eq('id', responseId)
    .single()

  const link = data.form_template.google_form_links[0]
  if (!link || !['push', 'bidirectional'].includes(link.sync_direction)) {
    return // Skip push
  }

  // Call n8n webhook
  const n8nWebhook = await getN8nPushWebhook(data.form_template.org_id)
  await fetch(n8nWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sheet_id: link.google_sheet_id,
      response_id: responseId,
      field_mapping: link.field_mapping,
      field_responses: data.form_field_responses,
      submitted_at: data.submitted_at,
    }),
  })
}
```

**n8n Workflow**: `google-forms-sync-push`

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Receive webhook from webapp                              │
│    → Extract sheet_id, field_responses, submitted_at        │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Build row array using field_mapping                      │
│    → Map form_field_ids to column order in Google Sheet     │
│    → Example: [timestamp, date, inspector, value1, value2]  │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Sheets API: append row                                   │
│    → spreadsheets.values.append(range="A:Z", values=[row])  │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. POST /api/sync/google/push-complete                      │
│    → {response_id, status: 'success', sheet_row_number}     │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Conflict Resolution

**Scenario**: Response edited in both Google Sheet AND webapp

**Detection**:
- Store `last_synced_at` per response
- On pull sync, compare Google Sheet row's "Last Modified" timestamp (if available) with webapp's `updated_at`
- If both changed since last sync → conflict

**Resolution Strategies** (per `sync_config.conflict_resolution`):

1. **webapp_wins** (RECOMMENDED for post-migration):
   - Ignore Google Sheet changes
   - Overwrite Google Sheet with webapp data on next push
   - Log conflict in `sync_log` for admin review

2. **google_wins** (useful during transition period):
   - Overwrite webapp data with Google Sheet data
   - Mark webapp response as "synced_from_google"
   - Notify admin of overwrite

3. **manual**:
   - Create `conflict_queue` table
   - Insert conflict record with both versions
   - Admin UI to review and choose winning version
   - Apply resolution + resume sync

**Implementation** (pseudocode):
```typescript
if (googleUpdatedAt > lastSyncedAt && webappUpdatedAt > lastSyncedAt) {
  const strategy = syncConfig.conflict_resolution

  if (strategy === 'webapp_wins') {
    await pushToGoogleSheet(response.id, { force: true })
    await logConflict('resolved_webapp_wins')
  } else if (strategy === 'google_wins') {
    await updateWebappResponse(response.id, googleData)
    await logConflict('resolved_google_wins')
  } else {
    await createConflictRecord(response.id, googleData, webappData)
    await notifyAdmin()
  }
}
```

## 6. n8n Workflow Definitions

### 6.1 Workflow: `google-forms-discovery`

**Trigger**: Webhook (POST /webhook/google-forms-discovery)

**Nodes**:
1. **Webhook** → Receives trigger from webapp
2. **Google Drive: List Folders** → Query for binder folders
3. **Loop Over Folders** → For each binder
4. **Google Drive: List Forms** → Get forms in folder
5. **Loop Over Forms** → For each form
6. **Google Forms API: Get Form** → Fetch form structure
7. **Set** → Format JSON payload
8. **HTTP Request** → POST to /api/sync/google/discovery-complete
9. **Respond to Webhook** → Return summary

**Estimated Execution Time**: 2-5 minutes (52 forms)

### 6.2 Workflow: `google-forms-sync-pull`

**Trigger**: Cron schedule (hourly: `0 * * * *`)

**Nodes**:
1. **Cron** → Triggers every hour
2. **HTTP Request** → GET /api/sync/google/forms-to-sync
   - Returns list of form_links needing sync
3. **Loop Over Forms** → For each form_link
4. **Google Sheets: Get Values** → Read new rows since last_synced_at
5. **Filter Empty** → Skip if no new rows
6. **Loop Over Rows** → For each response
7. **HTTP Request** → POST /api/sync/google/import-response
8. **Aggregate Results** → Count successes/failures
9. **HTTP Request** → POST /api/sync/google/pull-complete (update last_synced_at)
10. **Conditional: If Errors** → Send notification email

**Estimated Execution Time**: 5-15 minutes (depends on new response count)

### 6.3 Workflow: `google-forms-sync-push`

**Trigger**: Webhook (POST /webhook/google-forms-push)

**Nodes**:
1. **Webhook** → Receives response data from webapp
2. **Function** → Transform field_responses to row array
3. **Google Sheets: Append Row** → Add row to response sheet
4. **HTTP Request** → POST /api/sync/google/push-complete
5. **Respond to Webhook** → Return success

**Estimated Execution Time**: 2-5 seconds per response

### 6.4 Workflow: `google-forms-structure-sync`

**Trigger**: Cron schedule (daily: `0 2 * * *`) OR manual webhook

**Purpose**: Detect changes to form structure (new questions, removed questions)

**Nodes**:
1. **Cron/Webhook** → Trigger
2. **HTTP Request** → GET /api/sync/google/all-form-links
3. **Loop Over Forms** → For each linked form
4. **Google Forms API: Get Form** → Fetch current structure
5. **Function** → Compare with stored field_mapping
6. **Conditional: If Changed** →
   - POST /api/sync/google/update-form-fields (add/remove fields)
   - Log change in sync_log
7. **Aggregate** → Summary of changes
8. **Conditional: If Changes** → Email admin with summary

**Estimated Execution Time**: 10-20 minutes (52 forms)

### 6.5 n8n Deployment

**Options**:
- **Self-hosted** (Docker on VPS): Full control, no cost beyond hosting
- **n8n Cloud**: Managed service, $20-50/month, less maintenance

**Docker Compose** (self-hosted):
```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - WEBHOOK_URL=https://n8n.summitdigestive.com/
      - GENERIC_TIMEZONE=America/New_York
    volumes:
      - n8n_data:/home/node/.n8n
      - ./google-credentials.json:/home/node/.n8n/google-credentials.json
volumes:
  n8n_data:
```

**Workflow Backup**:
- Export workflows as JSON from n8n UI
- Store in git repo: `inspection-app/n8n-workflows/`
- Version control changes
- Restore on new n8n instance if needed

## 7. API Endpoints

### 7.1 Import & Discovery

**POST /api/sync/google/discovery**
- **Purpose**: Trigger n8n discovery workflow
- **Auth**: Admin only
- **Request**: `{ org_id: string }`
- **Response**: `{ workflow_url: string, estimated_time: "2-5 minutes" }`

**POST /api/sync/google/discovery-complete**
- **Purpose**: n8n callback with discovery results
- **Auth**: n8n webhook secret
- **Request**: Discovery JSON (see section 4.1)
- **Response**: `{ status: "saved", forms_found: 52 }`

**POST /api/sync/google/import-structure**
- **Purpose**: Import single form structure
- **Auth**: Admin only
- **Request**: `{ google_form_id: string, schedule_name: string, category: string }`
- **Response**: `{ template_id: string, fields_imported: number }`

**POST /api/sync/google/import-all**
- **Purpose**: Trigger full migration of all 52 forms
- **Auth**: Admin only
- **Request**: `{ org_id: string }`
- **Response**: `{ workflow_url: string, estimated_time: "60 minutes" }`

### 7.2 Ongoing Sync

**GET /api/sync/google/forms-to-sync**
- **Purpose**: n8n queries for forms needing sync
- **Auth**: n8n webhook secret
- **Response**:
  ```json
  {
    "forms": [
      {
        "id": "uuid",
        "google_form_id": "1FAI...",
        "google_sheet_id": "1XYZ...",
        "last_synced_at": "2026-02-07T08:00:00Z",
        "field_mapping": {...}
      }
    ]
  }
  ```

**POST /api/sync/google/import-response**
- **Purpose**: Import single response from Google
- **Auth**: n8n webhook secret (or admin for manual import)
- **Request**: See section 4.3
- **Response**: `{ status: "imported" | "skipped", response_id?: string }`

**POST /api/sync/google/pull-complete**
- **Purpose**: n8n callback after pull sync completes
- **Auth**: n8n webhook secret
- **Request**:
  ```json
  {
    "google_form_link_id": "uuid",
    "records_processed": 15,
    "records_failed": 0,
    "last_synced_at": "2026-02-07T09:00:00Z"
  }
  ```
- **Response**: `{ status: "updated" }`

**POST /api/sync/google/push-complete**
- **Purpose**: n8n callback after pushing response to Google
- **Auth**: n8n webhook secret
- **Request**:
  ```json
  {
    "response_id": "uuid",
    "status": "success" | "error",
    "google_row_number": 1234,
    "error_message": "..."
  }
  ```
- **Response**: `{ status: "updated" }`

### 7.3 Configuration & Monitoring

**GET /api/sync/status**
- **Purpose**: Dashboard health check
- **Auth**: Admin only
- **Response**:
  ```json
  {
    "last_pull_sync": "2026-02-07T09:00:00Z",
    "next_pull_sync": "2026-02-07T10:00:00Z",
    "forms_synced": 52,
    "total_responses": 10543,
    "recent_errors": [
      {
        "form_name": "Daily Equipment Check",
        "error": "Sheet not found",
        "timestamp": "2026-02-07T08:30:00Z"
      }
    ],
    "n8n_status": "healthy" | "unreachable"
  }
  ```

**GET /api/sync/logs**
- **Purpose**: View sync history
- **Auth**: Admin only
- **Query**: `?limit=50&offset=0&operation=pull`
- **Response**: Paginated list from `sync_log` table

**PUT /api/sync/config/:formId**
- **Purpose**: Configure sync settings for specific form
- **Auth**: Admin only
- **Request**:
  ```json
  {
    "sync_direction": "pull" | "push" | "bidirectional" | "disabled",
    "sync_frequency_minutes": 60
  }
  ```
- **Response**: `{ status: "updated" }`

**PUT /api/sync/config**
- **Purpose**: Update global sync settings
- **Auth**: Admin only
- **Request**:
  ```json
  {
    "auto_sync_enabled": true,
    "conflict_resolution": "webapp_wins",
    "notify_on_sync_error": true,
    "notification_email": "admin@summitdigestive.com"
  }
  ```
- **Response**: `{ status: "updated" }`

## 8. Environment Variables

### 8.1 Webapp (.env.local)

```bash
# Google Cloud credentials
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # Base64 or raw JSON
GOOGLE_SHARED_DRIVE_ID=0AByZ... # Parent shared drive ID (if using shared drives)

# n8n webhooks
N8N_BASE_URL=https://n8n.summitdigestive.com
N8N_IMPORT_WEBHOOK_URL=${N8N_BASE_URL}/webhook/google-forms-discovery
N8N_PULL_WEBHOOK_URL=${N8N_BASE_URL}/webhook/google-forms-pull
N8N_PUSH_WEBHOOK_URL=${N8N_BASE_URL}/webhook/google-forms-push
N8N_WEBHOOK_SECRET=random-secret-for-auth # n8n sends this in header

# Sync settings
SYNC_DEFAULT_FREQUENCY_MINUTES=60
SYNC_MAX_RETRIES=3
```

### 8.2 n8n Environment

```bash
# Google OAuth (if not using service account file mount)
GOOGLE_SERVICE_ACCOUNT_EMAIL=sync@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Webapp callback URL
WEBAPP_BASE_URL=https://app.summitdigestive.com
WEBAPP_WEBHOOK_SECRET=same-as-N8N_WEBHOOK_SECRET

# Timezone (for cron triggers)
GENERIC_TIMEZONE=America/New_York
```

## 9. Error Handling & Monitoring

### 9.1 Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Sheet not found (404)` | Google Sheet deleted/unlinked | Disable sync for this form, alert admin |
| `Rate limit exceeded (429)` | Too many API calls | Exponential backoff, reduce sync frequency |
| `Permission denied (403)` | Service account not shared on file | Re-share folder with service account email |
| `Invalid field mapping` | Form structure changed | Trigger structure sync, re-map fields |
| `Duplicate response ID` | Row imported twice | Skip (idempotency check) |
| `n8n webhook timeout` | Slow Sheet API response | Increase n8n execution timeout, retry |

### 9.2 Rate Limiting

**Google API Quotas** (per project, per day):
- Forms API: 30,000 read requests
- Sheets API: 500 read requests/100 seconds/user
- Drive API: 20,000 read requests

**Mitigation**:
- Batch requests where possible (Sheets API supports batch get)
- Cache form structures (only re-fetch on structure sync, not every pull)
- Use exponential backoff on 429 errors
- Monitor quota usage in Google Cloud Console

**Quota Monitoring** (add to sync dashboard):
```typescript
// Pseudo-code for quota tracking
const quotaUsage = await fetch('https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest')
  .then(r => r.json())
  .then(data => data.quota)

if (quotaUsage.remainingReads < 1000) {
  await notifyAdmin('Google Sheets API quota running low')
}
```

### 9.3 Retry Strategy

**Transient Errors** (network, timeouts):
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
      await sleep(delay)
    }
  }
  throw new Error('Retry limit exceeded')
}

// Usage
const form = await withRetry(() =>
  forms.forms.get({ formId: googleFormId })
)
```

**Permanent Errors** (404, 403):
- Log to `sync_log` with status='error'
- Disable auto-sync for affected form (`sync_direction='disabled'`)
- Send immediate notification to admin
- Provide admin UI to re-enable after fix

### 9.4 Monitoring Dashboard

**Metrics to Track**:
- Total forms synced (gauge)
- Responses imported in last 24h (counter)
- Failed sync attempts (counter)
- Average sync duration (histogram)
- Last successful sync per form (timestamp)

**UI Components** (Admin dashboard):
```tsx
// components/sync/sync-status-widget.tsx
export function SyncStatusWidget() {
  const { data } = useSWR('/api/sync/status')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Forms Sync</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <Label>Last Pull Sync</Label>
            <p>{formatDistanceToNow(data.last_pull_sync)} ago</p>
          </div>
          <div>
            <Label>Forms Active</Label>
            <p>{data.forms_synced} / 52</p>
          </div>
          {data.recent_errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>Sync Errors</AlertTitle>
              <AlertDescription>
                {data.recent_errors.map(e => (
                  <div key={e.timestamp}>
                    {e.form_name}: {e.error}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 9.5 Notifications

**Email Alerts** (using Resend or similar):
- Sync error: Immediate email to admin
- Quota warning: Daily digest if >80% quota used
- Import complete: Summary email after bulk import

**In-App Notifications**:
- Toast on manual sync trigger completion
- Badge on sync dashboard showing error count

## 10. Migration Timeline

### Phase 1: Read-Only Import (Week 1-2)

**Goal**: Import all existing data without modifying Google

**Tasks**:
1. Set up Google Cloud project, create service account
2. Share all binder folders with service account
3. Deploy n8n (Docker on VPS or n8n Cloud)
4. Build discovery workflow + structure import endpoint
5. Run discovery → identify all 52 forms
6. Manually review discovery results (ensure all forms found)
7. Build response import endpoint + workflow
8. Trigger bulk import (monitor for errors)
9. Validate: Compare response count in Google Sheets vs webapp DB
10. Set sync_direction='disabled' for all forms (no ongoing sync yet)

**Success Criteria**:
- All 52 forms imported as form_templates
- 10k+ responses imported (exact count TBD)
- Zero data loss (every Google response has matching webapp record)
- Admin can view historical data in webapp

**Rollback Plan**:
- Delete imported form_templates (cascades to responses)
- Re-run import with fixes

### Phase 2: Bi-Directional Sync (Week 3-4)

**Goal**: Enable ongoing sync while staff still use Google Forms

**Tasks**:
1. Build pull sync workflow (hourly cron)
2. Build push sync workflow (webhook from webapp)
3. Set sync_direction='bidirectional' for 2-3 pilot forms
4. Train staff to submit through webapp for pilot forms
5. Monitor sync logs for conflicts/errors over 1 week
6. Gradually enable sync for remaining forms (5-10 per day)
7. Implement conflict resolution UI for manual review
8. Set up email alerts for sync errors

**Success Criteria**:
- New Google Form responses appear in webapp within 1 hour
- New webapp responses appear in Google Sheets within 5 minutes
- <5% conflict rate (Google and webapp edits)
- Staff report no data loss or duplication

**Rollback Plan**:
- Set sync_direction='pull' (disable push)
- Staff revert to Google Forms-only workflow

### Phase 3: Webapp as Primary (Week 5-6)

**Goal**: Transition staff to webapp, Google as backup only

**Tasks**:
1. Train all staff on webapp form submission (in-person or video)
2. Update Google Forms with notice: "Use webapp instead"
3. Set sync_direction='push' (webapp → Google only)
4. Disable Google Form accepting responses (make read-only)
5. Monitor for staff confusion or workflow issues
6. After 2 weeks: Set sync_direction='disabled' (no Google sync)
7. Archive Google Sheets (move to "Archive" folder in Drive)

**Success Criteria**:
- 100% of new responses submitted via webapp
- Zero active Google Form submissions
- Staff report improved UX vs Google Forms
- Data integrity maintained (no lost submissions)

**Rollback Plan**:
- Re-enable Google Forms
- Set sync_direction='bidirectional'
- Communicate temporary revert to staff

### Phase 4: Google Deprecation (Month 3+)

**Goal**: Fully decouple from Google ecosystem

**Tasks**:
1. Export all Google Sheets as CSV (archival backup)
2. Delete google_form_links table (or set all to sync_direction='disabled')
3. Remove Google API credentials from env
4. Shut down n8n workflows (keep n8n for other automations)
5. Redirect /api/sync/google/* endpoints to 410 Gone

**Success Criteria**:
- No active Google API usage
- Webapp fully self-sufficient
- Historical data preserved in webapp + CSV backups

## 11. Code Snippets & Examples

### 11.1 Google Auth Helper

```typescript
// lib/google/auth.ts
import { google } from 'googleapis'

let authClient: any = null

export function getGoogleAuth() {
  if (authClient) return authClient

  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'
  )

  authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/forms.body',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  })

  return authClient
}

export async function getGoogleClients() {
  const auth = await getGoogleAuth().getClient()

  return {
    forms: google.forms({ version: 'v1', auth }),
    sheets: google.sheets({ version: 'v4', auth }),
    drive: google.drive({ version: 'v3', auth }),
  }
}
```

### 11.2 Parse Google Sheet Row

```typescript
// lib/sync/parse-sheet-row.ts
export function parseSheetRowToResponse(
  row: string[],
  headers: string[],
  fieldMapping: Record<string, string> // google_field_id → form_field_id
) {
  const response: Record<string, any> = {}

  // Extract standard fields
  const timestampIdx = headers.indexOf('Timestamp')
  const dateIdx = headers.indexOf('Date')
  const inspectorIdx = headers.indexOf('Inspector Name')

  response.submitted_at = row[timestampIdx]
    ? new Date(row[timestampIdx])
    : new Date()
  response.inspection_date = row[dateIdx]
  response.inspector_name = row[inspectorIdx]

  // Map custom fields
  const fieldValues: Record<string, string> = {}

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const googleFieldId = `entry.${i}` // Approximate; real mapping is complex
    const formFieldId = fieldMapping[googleFieldId]

    if (formFieldId && row[i]) {
      fieldValues[formFieldId] = row[i]
    }
  }

  response.field_values = fieldValues
  return response
}
```

### 11.3 n8n Workflow JSON (Excerpt)

```json
{
  "name": "google-forms-sync-pull",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{ "field": "hours", "hoursInterval": 1 }]
        }
      },
      "name": "Schedule (Every Hour)",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "https://app.summitdigestive.com/api/sync/google/forms-to-sync",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth"
      },
      "name": "Get Forms to Sync",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "name": "Loop Over Forms",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [650, 300]
    }
  ],
  "connections": {
    "Schedule (Every Hour)": {
      "main": [
        [{ "node": "Get Forms to Sync", "type": "main", "index": 0 }]
      ]
    },
    "Get Forms to Sync": {
      "main": [
        [{ "node": "Loop Over Forms", "type": "main", "index": 0 }]
      ]
    }
  }
}
```

## 12. Open Questions & Decisions Needed

1. **Google Forms Field ID Mapping**: Google Forms API uses internal IDs (not visible in UI). How to reliably map form fields to spreadsheet columns?
   - **Answer**: Use Forms API response object's `item.questionItem.question.questionId` + parse spreadsheet headers

2. **User Mapping**: Google Forms collect email (if logged in) or free-text name. How to map to webapp users?
   - **Option A**: Match by email (require staff to use work email)
   - **Option B**: Create `external_inspector_name` field, don't link to user table initially

3. **n8n Hosting**: Self-host or use n8n Cloud?
   - **Recommendation**: Start with n8n Cloud ($20/month) for faster setup, migrate to self-hosted if costs grow

4. **Form Versioning**: What if admin edits Google Form structure (add question) during sync?
   - **Solution**: Daily structure sync workflow detects changes, creates new `form_fields`, updates `field_mapping`

5. **Large Response Files**: Some forms may have 5k+ responses. How to handle import without timeout?
   - **Solution**: Paginate in n8n (1000 rows per batch), use separate webhook calls for each batch

6. **Data Validation**: Google Forms allow invalid data (typos, out-of-range). Import as-is or validate?
   - **Recommendation**: Import as-is initially, add validation to webapp for new submissions, flag invalid legacy data for cleanup

## 13. Success Metrics

### Import Phase
- Time to import all 52 forms: <2 hours
- Data accuracy: 100% (zero lost responses)
- Admin satisfaction: Can view all historical data

### Sync Phase
- Sync latency: <1 hour (pull), <5 minutes (push)
- Error rate: <2% of sync operations
- Conflict rate: <5% of responses
- Staff satisfaction: No complaints about missing data

### Migration Complete
- Webapp submission rate: 100% (zero Google Form submissions)
- System uptime: 99.9%
- Data integrity: Zero lost submissions in 30 days

## 14. Appendix

### A. Google Forms API Response Example

```json
{
  "formId": "1FAIpQLSdXYZ...",
  "info": {
    "title": "Daily Equipment Check",
    "description": "Check all equipment before shift"
  },
  "linkedSheetId": "1XYZ...",
  "items": [
    {
      "itemId": "12345678",
      "title": "Equipment is clean and sanitized",
      "questionItem": {
        "question": {
          "questionId": "abc123",
          "required": true,
          "choiceQuestion": {
            "type": "RADIO",
            "options": [
              { "value": "Yes" },
              { "value": "No" },
              { "value": "N/A" }
            ]
          }
        }
      }
    }
  ]
}
```

### B. Google Sheets Response Example

| Timestamp           | Date       | Inspector Name | Equipment is clean | Temperature |
|---------------------|------------|----------------|--------------------|-------------|
| 1/15/2026 10:23:45 | 01/15/2026 | Jane Smith     | Yes                | 72°F        |
| 1/15/2026 14:15:32 | 01/15/2026 | John Doe       | Yes                | 71°F        |

### C. SQL Queries

**Find forms with recent sync errors**:
```sql
SELECT
  gfl.id,
  ft.name as form_name,
  sl.error_details->>'message' as error,
  sl.started_at
FROM google_form_links gfl
JOIN form_templates ft ON ft.id = gfl.form_template_id
JOIN sync_log sl ON sl.google_form_link_id = gfl.id
WHERE sl.status = 'error'
  AND sl.started_at > now() - interval '24 hours'
ORDER BY sl.started_at DESC
```

**Count responses by sync status**:
```sql
SELECT
  synced_to_google,
  COUNT(*) as response_count
FROM form_responses
WHERE created_at > now() - interval '7 days'
GROUP BY synced_to_google
```

### D. Security Considerations

1. **Service Account Key Protection**:
   - Never commit JSON key to git
   - Store in environment variable (base64 encoded)
   - Rotate key every 90 days
   - Restrict key to minimum required scopes

2. **n8n Webhook Security**:
   - Use HTTPS only
   - Require shared secret in header: `X-Webhook-Secret`
   - Validate webhook source IP (if static)
   - Rate limit webhook endpoints

3. **Google Drive Permissions**:
   - Only share binders with service account (not entire drive)
   - Use "Viewer" role where possible (read-only)
   - Audit shared files quarterly

4. **Data Privacy**:
   - HIPAA compliance: Ensure Google Workspace is HIPAA-compliant (BAA signed)
   - Audit logs: Enable Google Workspace audit logging
   - Access control: Limit who can trigger import/sync operations

---

**Next Steps**:
1. Review this plan with Summit Digestive stakeholders
2. Get access to Google Workspace admin console
3. Create Google Cloud project + service account
4. Share test binder folder with service account
5. Build Phase 1 discovery + import (estimate 1-2 weeks)

**Questions?** Contact technical lead for clarification on any section.
