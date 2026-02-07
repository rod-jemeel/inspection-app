# PLAN_07: Form Responses & Inspection UI

**Status**: Draft
**Dependencies**: PLAN_01 (Binder/Form System), PLAN_04 (Access Control)
**Created**: 2026-02-07

---

## 1. Current Inspection Flow

### 1.1 Existing Database Schema

**Table**: `inspection_instances`

```sql
CREATE TABLE inspection_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES inspection_templates(id),
  profile_id UUID NOT NULL REFERENCES profiles(user_id),
  location_id UUID NOT NULL REFERENCES locations(id),
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'void')),
  remarks TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Related Tables**:
- `inspection_events`: Timeline of status changes
- `inspection_signatures`: Digital signatures after passing

### 1.2 Current User Flow

**Inspector Journey**:

1. **Open Inspection**:
   - Navigate to `/inspections/[id]`
   - See inspection details (template name, location, scheduled date, status)

2. **Change Status**:
   - Click status dropdown
   - Select: pending → in_progress → passed/failed
   - Optional: void inspection (if cancelled)

3. **Add Remarks**:
   - Free text area for notes
   - No structured data capture
   - No validation

4. **Sign & Complete** (if passed):
   - Draw signature on canvas pad
   - Submit → saves signature as PNG
   - Marks inspection as complete

5. **View Activity Timeline**:
   - See all status changes with timestamps
   - See who made each change

**Current UI** (`app/inspections/[id]/page.tsx`):

```
┌──────────────────────────────────────────────┐
│ ← Back to Dashboard                          │
├──────────────────────────────────────────────┤
│                                              │
│ Fire Extinguisher Inspection                 │
│ Location: Building A - 2nd Floor             │
│ Scheduled: Feb 7, 2026                       │
│                                              │
│ Status: [Pending ▼]                          │
│                                              │
│ Remarks:                                     │
│ ┌──────────────────────────────────────┐   │
│ │                                      │   │
│ │ (Free text area)                     │   │
│ │                                      │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ [Save Remarks]                               │
│                                              │
│ ── Signature (if passed) ──                  │
│                                              │
│ [Signature Canvas Pad]                       │
│                                              │
│ [Clear] [Sign & Complete]                    │
│                                              │
│ ── Activity Timeline ──                      │
│                                              │
│ • Feb 7, 2026 10:00 AM - Created (John Doe)  │
│ • Feb 7, 2026 10:05 AM - Started (John Doe)  │
│ • Feb 7, 2026 10:15 AM - Passed (John Doe)   │
│                                              │
└──────────────────────────────────────────────┘
```

**Limitations**:
- ❌ No structured checklist (just free text)
- ❌ No field validation (e.g., temperature ranges)
- ❌ No photo attachments for failed items
- ❌ No draft saving (must complete in one session)
- ❌ No auto-pass/fail logic based on responses
- ❌ No selfie capture for identity verification

---

## 2. New Form-Based Inspection Flow

### 2.1 Database Schema (from PLAN_01)

**Table**: `form_responses`

```sql
CREATE TABLE form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES inspection_instances(id) ON DELETE CASCADE,
  form_template_id UUID NOT NULL REFERENCES form_templates(id),
  submitted_by UUID NOT NULL REFERENCES profiles(user_id),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  signature_url TEXT,
  selfie_url TEXT,
  auto_fail_triggered BOOLEAN DEFAULT FALSE,
  fail_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_responses_instance ON form_responses(instance_id);
CREATE INDEX idx_form_responses_status ON form_responses(status);
```

**Table**: `form_field_responses`

```sql
CREATE TABLE form_field_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES form_fields(id),
  value JSONB NOT NULL,  -- Stores response value (boolean, string, number, array, etc.)
  flagged BOOLEAN DEFAULT FALSE,  -- True if value triggers failure
  notes TEXT,  -- Inspector notes for this specific field
  photo_urls TEXT[],  -- Photos for this field (e.g., damaged equipment)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(response_id, field_id)
);

CREATE INDEX idx_form_field_responses_response ON form_field_responses(response_id);
CREATE INDEX idx_form_field_responses_flagged ON form_field_responses(flagged);
```

**Relationship**:
```
inspection_instances (1) ─── (1) form_responses ─── (*) form_field_responses
                                                              ↓
                                                         form_fields
```

### 2.2 New User Flow

**Inspector Journey**:

1. **Open Inspection**:
   - Navigate to `/inspections/[id]`
   - See inspection header (template name, location, scheduled date)
   - See form rendered dynamically from `form_fields` table

2. **Fill Form Fields**:
   - See all checklist items from form template
   - Fill each field based on type:
     - **Checkbox**: ✓ Pass / ✗ Fail
     - **Text**: Free text input
     - **Number**: Numeric input (temperature, pressure, etc.)
     - **Select**: Dropdown (e.g., condition: Good/Fair/Poor)
     - **Photo**: Take/upload photo (damaged equipment)
   - See field validation in real-time:
     - Temperature out of range → red border + warning
     - Required field empty → cannot submit
   - Add field-specific notes (optional)

3. **Save Draft** (optional):
   - Click "Save Draft" → saves partial responses
   - Can close and return later
   - Draft status: `form_responses.status = 'draft'`

4. **Submit Form**:
   - Click "Submit Inspection"
   - Validation runs:
     - All required fields filled?
     - All values within acceptable ranges?
   - If validation passes → proceed to signature

5. **Auto-Pass/Fail Logic**:
   - System evaluates responses:
     - If any critical field fails → inspection fails
     - If all fields pass → inspection passes
   - Result shown: "Inspection Passed ✓" or "Inspection Failed ✗"

6. **Sign & Selfie**:
   - Draw signature on canvas pad
   - Capture selfie with camera (identity verification)
   - Submit → saves signature + selfie as images

7. **View Submission**:
   - Redirected to read-only view of submitted form
   - See all field values, signature, selfie
   - See pass/fail result with reason

**New UI** (`app/inspections/[id]/page.tsx`):

```
┌────────────────────────────────────────────────────────────┐
│ ← Back to Dashboard                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Fire Extinguisher Inspection                               │
│ Location: Building A - 2nd Floor                           │
│ Scheduled: Feb 7, 2026                                     │
│                                                            │
│ Status: In Progress 🟡  [Save Draft] [Submit Inspection]   │
│                                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                            │
│ Progress: ████████░░░░░░  60% (3/5 required fields)        │
│                                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                            │
│ 1. Extinguisher Present? *                                 │
│    ( ) Pass ✓  (•) Fail ✗                                  │
│                                                            │
│    ⚠️ This is a critical field. Failure will fail the       │
│       entire inspection.                                   │
│                                                            │
│    Notes: [Not found at designated location]              │
│    Photos: [📷 Take Photo]                                 │
│                                                            │
│ ──────────────────────────────────────────────────────    │
│                                                            │
│ 2. Pressure Gauge Reading (PSI) *                          │
│    [120] PSI                                               │
│                                                            │
│    ✓ Within acceptable range (100-150 PSI)                 │
│                                                            │
│ ──────────────────────────────────────────────────────    │
│                                                            │
│ 3. Inspection Tag Date                                     │
│    [2026-01-15] (Date picker)                              │
│                                                            │
│ ──────────────────────────────────────────────────────    │
│                                                            │
│ 4. Physical Condition *                                    │
│    [Good ▼] (Dropdown: Good / Fair / Poor / Damaged)       │
│                                                            │
│ ──────────────────────────────────────────────────────    │
│                                                            │
│ 5. Overall Notes                                           │
│    ┌────────────────────────────────────────────┐         │
│    │ General inspection notes...                │         │
│    └────────────────────────────────────────────┘         │
│                                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                            │
│ [Save Draft] [Submit Inspection]                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Submission Modal** (after clicking "Submit Inspection"):

```
┌────────────────────────────────────────────────────────────┐
│ Submit Inspection                               [✕ Close]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ⚠️ Inspection Result: FAILED                                │
│                                                            │
│ Reason: Critical field failed                              │
│ • Extinguisher Present: FAIL ✗                             │
│                                                            │
│ ──────────────────────────────────────────────────────    │
│                                                            │
│ Step 1: Review Failed Items                                │
│                                                            │
│ You must document the failure before submitting.           │
│                                                            │
│ Field: Extinguisher Present                                │
│ Notes: [Required - describe the issue]                     │
│ Photos: [📷 Take Photo] (Optional but recommended)         │
│                                                            │
│ ──────────────────────────────────────────────────────    │
│                                                            │
│ Step 2: Sign & Verify                                      │
│                                                            │
│ Signature:                                                 │
│ ┌────────────────────────────────────────────┐           │
│ │                                            │           │
│ │      (Signature Canvas Pad)                │           │
│ │                                            │           │
│ └────────────────────────────────────────────┘           │
│ [Clear Signature]                                          │
│                                                            │
│ Selfie Verification:                                       │
│ [📷 Capture Selfie]  or  [⬆ Upload Photo]                 │
│                                                            │
│ ──────────────────────────────────────────────────────    │
│                                                            │
│ ☑️ I confirm all information is accurate                    │
│                                                            │
│ [Cancel] [Submit Failed Inspection]                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Success State** (after submission):

```
┌────────────────────────────────────────────────────────────┐
│ ✓ Inspection Submitted                                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Your inspection has been submitted and recorded.           │
│                                                            │
│ Result: FAILED ✗                                           │
│ Submitted: Feb 7, 2026 at 10:15 AM                         │
│                                                            │
│ [View Full Report] [Back to Dashboard]                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Big Modal for Response Viewing/Editing

### 3.1 Requirements

**Who can view**:
- Owner/Admin: All submitted responses
- Inspector/Nurse: Only their own submissions

**When opened**:
- From dashboard "Recent Inspections" table (click row)
- From inspection detail page (after submission)
- From binder compliance view (drill-down to specific response)

**Features**:
- Large modal (full-screen on mobile, 80% width on desktop)
- Read-only view for submitted responses
- Editable view for draft responses
- Print-friendly layout (for regulatory audits)
- PDF export button
- Signature and selfie displayed
- All field values with labels
- Failed fields highlighted in red

### 3.2 UI Design (ASCII Wireframe)

**Read-Only View**:

```
┌──────────────────────────────────────────────────────────────────┐
│ Fire Extinguisher Inspection - Response           [Print] [PDF]  │
│                                                      [✕ Close]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Inspection Details                                         │ │
│ ├────────────────────────────────────────────────────────────┤ │
│ │ Form: Fire Extinguisher Inspection                         │ │
│ │ Location: Building A - 2nd Floor                           │ │
│ │ Scheduled: Feb 7, 2026                                     │ │
│ │ Submitted: Feb 7, 2026 at 10:15 AM                         │ │
│ │ Inspector: John Doe                                        │ │
│ │ Result: FAILED ✗                                           │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Inspection Responses                                       │ │
│ ├────────────────────────────────────────────────────────────┤ │
│ │                                                            │ │
│ │ 1. Extinguisher Present?                     CRITICAL      │ │
│ │    ✗ FAIL                                                  │ │
│ │    Notes: Not found at designated location                 │ │
│ │    Photos: [📷 IMG_001.jpg] [📷 IMG_002.jpg]               │ │
│ │    ⚠️ This field caused the inspection to fail             │ │
│ │                                                            │ │
│ │ ──────────────────────────────────────────────────────    │ │
│ │                                                            │ │
│ │ 2. Pressure Gauge Reading (PSI)                            │ │
│ │    120 PSI                                                 │ │
│ │    ✓ Within acceptable range (100-150 PSI)                 │ │
│ │                                                            │ │
│ │ ──────────────────────────────────────────────────────    │ │
│ │                                                            │ │
│ │ 3. Inspection Tag Date                                     │ │
│ │    Jan 15, 2026                                            │ │
│ │                                                            │ │
│ │ ──────────────────────────────────────────────────────    │ │
│ │                                                            │ │
│ │ 4. Physical Condition                                      │ │
│ │    Good                                                    │ │
│ │                                                            │ │
│ │ ──────────────────────────────────────────────────────    │ │
│ │                                                            │ │
│ │ 5. Overall Notes                                           │ │
│ │    Extinguisher missing from wall mount. Notified          │ │
│ │    facility manager. Replacement ordered.                  │ │
│ │                                                            │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Verification                                               │ │
│ ├────────────────────────────────────────────────────────────┤ │
│ │                                                            │ │
│ │ Signature:                    Selfie:                      │ │
│ │ ┌───────────────────────┐     ┌───────────────────────┐   │ │
│ │ │                       │     │                       │   │ │
│ │ │   [Signature Image]   │     │   [Selfie Image]      │   │ │
│ │ │                       │     │                       │   │ │
│ │ └───────────────────────┘     └───────────────────────┘   │ │
│ │                                                            │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Activity Timeline                                          │ │
│ ├────────────────────────────────────────────────────────────┤ │
│ │                                                            │ │
│ │ • Feb 7, 2026 10:00 AM - Inspection created (Auto)         │ │
│ │ • Feb 7, 2026 10:05 AM - Started by John Doe               │ │
│ │ • Feb 7, 2026 10:10 AM - Draft saved                       │ │
│ │ • Feb 7, 2026 10:15 AM - Submitted as FAILED (John Doe)    │ │
│ │                                                            │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [Close]                                                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Editable View (Draft)**:

```
┌──────────────────────────────────────────────────────────────────┐
│ Fire Extinguisher Inspection - Edit Draft         [✕ Close]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Status: Draft 🟡  Progress: 60% (3/5 required fields)            │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 1. Extinguisher Present? *                                 │ │
│ │    ( ) Pass ✓  (•) Fail ✗                                  │ │
│ │    Notes: [Not found at designated location]              │ │
│ │    Photos: [📷 Take Photo]                                 │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ (... other fields ...)                                           │
│                                                                  │
│ [Save Draft] [Submit Inspection]                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Print-Friendly View

**CSS for Print**:

```css
@media print {
  /* Hide UI elements */
  .modal-header-actions,
  .close-button,
  .edit-button,
  .nav-sidebar {
    display: none !important;
  }

  /* Full width for content */
  .response-modal {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Page breaks */
  .response-section {
    page-break-inside: avoid;
  }

  /* Signature and selfie side-by-side */
  .verification-section {
    display: flex;
    gap: 2rem;
  }

  .signature-image,
  .selfie-image {
    width: 45%;
  }

  /* Remove colors for grayscale printing */
  .field-failed {
    border: 2px solid #000 !important;
    background: #eee !important;
  }
}
```

**Print Header** (added to print view):

```
┌──────────────────────────────────────────────────────────────────┐
│                     [Company Logo]                               │
│                                                                  │
│            INSPECTION REPORT - OFFICIAL RECORD                   │
│                                                                  │
│ Report ID: INS-2026-02-07-001                                    │
│ Generated: Feb 7, 2026 at 10:15 AM                               │
│ Page 1 of 2                                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Auto-Pass/Fail Logic

### 4.1 Field Configuration

**Add to `form_fields` table** (from PLAN_01):

```sql
ALTER TABLE form_fields
  ADD COLUMN is_critical BOOLEAN DEFAULT FALSE,
  ADD COLUMN validation_rules JSONB,
  ADD COLUMN fail_on_value JSONB;  -- If response matches this, field fails
```

**Example `validation_rules` JSONB**:

```json
{
  "required": true,
  "type": "number",
  "min": 100,
  "max": 150,
  "unit": "PSI",
  "error_message": "Pressure must be between 100-150 PSI"
}
```

**Example `fail_on_value` JSONB**:

```json
{
  "operator": "equals",
  "value": false,
  "reason": "Extinguisher must be present"
}
```

**For checkbox fields**:
- `fail_on_value: { "operator": "equals", "value": false }` → Fails if unchecked

**For numeric fields**:
- `fail_on_value: { "operator": "out_of_range", "min": 100, "max": 150 }` → Fails if value < 100 or > 150

**For select fields**:
- `fail_on_value: { "operator": "in", "values": ["Poor", "Damaged"] }` → Fails if selected

### 4.2 Evaluation Algorithm

**Server-Side Logic** (`lib/actions/form-responses.ts`):

```typescript
interface FieldEvaluation {
  field_id: string
  field_label: string
  passed: boolean
  is_critical: boolean
  fail_reason?: string
}

export async function evaluateFormResponse(responseId: string): Promise<{
  overall_passed: boolean
  failed_fields: FieldEvaluation[]
  fail_reason?: string
}> {
  // Get all field responses
  const fieldResponses = await db.query(
    `SELECT ffr.*, ff.label, ff.is_critical, ff.fail_on_value, ff.validation_rules
     FROM form_field_responses ffr
     JOIN form_fields ff ON ff.id = ffr.field_id
     WHERE ffr.response_id = $1`,
    [responseId]
  )

  const failedFields: FieldEvaluation[] = []

  for (const field of fieldResponses.rows) {
    const evaluation = evaluateField(field)

    if (!evaluation.passed) {
      failedFields.push(evaluation)

      // Mark field as flagged
      await db.query(
        `UPDATE form_field_responses SET flagged = true WHERE id = $1`,
        [field.id]
      )
    }
  }

  // Determine overall pass/fail
  const criticalFailures = failedFields.filter(f => f.is_critical)
  const overall_passed = criticalFailures.length === 0

  let fail_reason: string | undefined
  if (!overall_passed) {
    fail_reason = `Critical field(s) failed: ${criticalFailures.map(f => f.field_label).join(', ')}`
  }

  return {
    overall_passed,
    failed_fields: failedFields,
    fail_reason
  }
}

function evaluateField(field: any): FieldEvaluation {
  const { id, label, value, is_critical, fail_on_value } = field

  if (!fail_on_value) {
    // No fail condition defined, always pass
    return { field_id: id, field_label: label, passed: true, is_critical }
  }

  const { operator, value: failValue, min, max, values } = fail_on_value
  let passed = true
  let fail_reason: string | undefined

  switch (operator) {
    case 'equals':
      if (value === failValue) {
        passed = false
        fail_reason = `Value must not be ${failValue}`
      }
      break

    case 'not_equals':
      if (value !== failValue) {
        passed = false
        fail_reason = `Value must be ${failValue}`
      }
      break

    case 'out_of_range':
      const numValue = parseFloat(value)
      if (numValue < min || numValue > max) {
        passed = false
        fail_reason = `Value must be between ${min} and ${max}`
      }
      break

    case 'in':
      if (values.includes(value)) {
        passed = false
        fail_reason = `Value must not be one of: ${values.join(', ')}`
      }
      break

    case 'not_in':
      if (!values.includes(value)) {
        passed = false
        fail_reason = `Value must be one of: ${values.join(', ')}`
      }
      break

    default:
      console.warn(`Unknown operator: ${operator}`)
  }

  return { field_id: id, field_label: label, passed, is_critical, fail_reason }
}
```

**Usage in Submit Endpoint**:

```typescript
// POST /api/inspections/[id]/submit
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { profile } = await requireRole(['inspector', 'nurse'])
  const { id } = await params
  const { response_id, signature_url, selfie_url } = await request.json()

  // Evaluate form response
  const evaluation = await evaluateFormResponse(response_id)

  // Update form_responses table
  await db.query(
    `UPDATE form_responses SET
      status = 'submitted',
      signature_url = $1,
      selfie_url = $2,
      auto_fail_triggered = $3,
      fail_reason = $4,
      submitted_at = NOW()
    WHERE id = $5`,
    [
      signature_url,
      selfie_url,
      !evaluation.overall_passed,
      evaluation.fail_reason,
      response_id
    ]
  )

  // Update inspection_instances status
  const finalStatus = evaluation.overall_passed ? 'passed' : 'failed'
  await db.query(
    `UPDATE inspection_instances SET
      status = $1,
      completed_at = NOW()
    WHERE id = $2`,
    [finalStatus, id]
  )

  // Log event
  await db.query(
    `INSERT INTO inspection_events (instance_id, event_type, user_id, details)
     VALUES ($1, $2, $3, $4)`,
    [id, 'submitted', profile.user_id, JSON.stringify({ result: finalStatus })]
  )

  revalidateTag('dashboard')

  return Response.json({
    success: true,
    status: finalStatus,
    failed_fields: evaluation.failed_fields
  })
}
```

### 4.3 Admin Configurable Thresholds

**UI for Form Template Editor** (Owner/Admin):

```
┌────────────────────────────────────────────────────────────┐
│ Edit Field: Pressure Gauge Reading                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Field Label: [Pressure Gauge Reading (PSI)]               │
│ Field Type: [Number ▼]                                     │
│                                                            │
│ ☑️ Required Field                                           │
│ ☑️ Critical Field (failure causes inspection to fail)       │
│                                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                            │
│ Validation Rules:                                          │
│                                                            │
│ Minimum Value: [100]  Unit: [PSI]                          │
│ Maximum Value: [150]                                       │
│                                                            │
│ ☑️ Fail inspection if out of range                          │
│                                                            │
│ Error Message:                                             │
│ [Pressure must be between 100-150 PSI]                     │
│                                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                            │
│ [Cancel] [Save Field]                                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 5. UI Components Needed

### 5.1 FormRenderer

**Purpose**: Dynamically render form fields based on `form_fields` configuration.

**File**: `components/inspections/form-renderer.tsx`

```typescript
"use client"

import { useState, useEffect } from 'react'
import { FieldInput } from './field-input'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface FormField {
  id: string
  label: string
  type: string
  required: boolean
  is_critical: boolean
  validation_rules: any
  order: number
}

interface FormResponse {
  [field_id: string]: any
}

export function FormRenderer({
  fields,
  initialResponses,
  onSave,
  onSubmit,
  readOnly = false
}: {
  fields: FormField[]
  initialResponses?: FormResponse
  onSave?: (responses: FormResponse) => Promise<void>
  onSubmit?: (responses: FormResponse) => Promise<void>
  readOnly?: boolean
}) {
  const [responses, setResponses] = useState<FormResponse>(initialResponses || {})
  const [saving, setSaving] = useState(false)

  const requiredFields = fields.filter(f => f.required)
  const completedFields = requiredFields.filter(f => responses[f.id] !== undefined && responses[f.id] !== '')
  const progress = Math.round((completedFields.length / requiredFields.length) * 100)

  const handleFieldChange = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    await onSave?.(responses)
    setSaving(false)
  }

  const handleSubmit = async () => {
    // Validate all required fields
    const missingFields = requiredFields.filter(f => !responses[f.id])
    if (missingFields.length > 0) {
      alert(`Please complete all required fields: ${missingFields.map(f => f.label).join(', ')}`)
      return
    }

    await onSubmit?.(responses)
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="sticky top-0 z-10 bg-background border-b pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Progress: {completedFields.length}/{requiredFields.length} required fields
            </span>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {fields
        .sort((a, b) => a.order - b.order)
        .map((field, index) => (
          <div key={field.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <label className="font-medium">
                {index + 1}. {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </label>
              {field.is_critical && (
                <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">
                  CRITICAL
                </span>
              )}
            </div>

            <FieldInput
              field={field}
              value={responses[field.id]}
              onChange={(value) => handleFieldChange(field.id, value)}
              readOnly={readOnly}
            />

            {field.is_critical && !readOnly && (
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ This is a critical field. Failure will fail the entire inspection.
              </p>
            )}
          </div>
        ))}

      {!readOnly && (
        <div className="flex gap-4 sticky bottom-0 bg-background border-t pt-4">
          <Button onClick={handleSaveDraft} variant="outline" disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button onClick={handleSubmit} disabled={progress < 100}>
            Submit Inspection
          </Button>
        </div>
      )}
    </div>
  )
}
```

### 5.2 FieldInput

**Purpose**: Render individual field input based on field type.

**File**: `components/inspections/field-input.tsx`

```typescript
"use client"

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PhotoUpload } from './photo-upload'

export function FieldInput({
  field,
  value,
  onChange,
  readOnly = false
}: {
  field: any
  value: any
  onChange: (value: any) => void
  readOnly?: boolean
}) {
  const { type, validation_rules } = field

  switch (type) {
    case 'checkbox':
    case 'boolean':
      return (
        <RadioGroup value={value?.toString()} onValueChange={(v) => onChange(v === 'true')} disabled={readOnly}>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id={`${field.id}-pass`} />
              <Label htmlFor={`${field.id}-pass`}>Pass ✓</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id={`${field.id}-fail`} />
              <Label htmlFor={`${field.id}-fail`}>Fail ✗</Label>
            </div>
          </div>
        </RadioGroup>
      )

    case 'number':
      const { min, max, unit } = validation_rules || {}
      const isValid = value === undefined || (value >= min && value <= max)

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              min={min}
              max={max}
              readOnly={readOnly}
              className={!isValid ? 'border-destructive' : ''}
            />
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {isValid && value !== undefined && (
            <p className="text-xs text-green-600">✓ Within acceptable range ({min}-{max} {unit})</p>
          )}
          {!isValid && value !== undefined && (
            <p className="text-xs text-destructive">⚠️ Value must be between {min}-{max} {unit}</p>
          )}
        </div>
      )

    case 'text':
      return (
        <Input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
        />
      )

    case 'textarea':
      return (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          readOnly={readOnly}
        />
      )

    case 'select':
      const options = validation_rules?.options || []
      return (
        <Select value={value} onValueChange={onChange} disabled={readOnly}>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case 'date':
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
        />
      )

    case 'photo':
      return (
        <PhotoUpload
          value={value}
          onChange={onChange}
          readOnly={readOnly}
        />
      )

    default:
      return <p className="text-sm text-muted-foreground">Unknown field type: {type}</p>
  }
}
```

### 5.3 ResponseModal

**Purpose**: Large modal for viewing submitted form responses.

**File**: `components/inspections/response-modal.tsx`

```typescript
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Printer } from 'lucide-react'
import { FormRenderer } from './form-renderer'

export function ResponseModal({
  open,
  onClose,
  response
}: {
  open: boolean
  onClose: () => void
  response: any
}) {
  const handlePrint = () => {
    window.print()
  }

  const handleExportPDF = async () => {
    // Generate PDF using jspdf
    const { generateResponsePDF } = await import('@/lib/pdf/response-pdf')
    generateResponsePDF(response)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="no-print">
          <div className="flex items-center justify-between">
            <DialogTitle>{response.form_name} - Response</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Inspection Details */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Inspection Details</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Form</dt>
                <dd className="font-medium">{response.form_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-medium">{response.location_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Scheduled</dt>
                <dd className="font-medium">{response.scheduled_date}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="font-medium">{response.submitted_at}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Inspector</dt>
                <dd className="font-medium">{response.inspector_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Result</dt>
                <dd className={`font-bold ${response.status === 'passed' ? 'text-green-600' : 'text-destructive'}`}>
                  {response.status === 'passed' ? '✓ PASSED' : '✗ FAILED'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Form Responses (read-only) */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Inspection Responses</h3>
            <FormRenderer
              fields={response.fields}
              initialResponses={response.field_responses}
              readOnly={true}
            />
          </div>

          {/* Signature & Selfie */}
          {(response.signature_url || response.selfie_url) && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Verification</h3>
              <div className="grid grid-cols-2 gap-4">
                {response.signature_url && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Signature:</p>
                    <img src={response.signature_url} alt="Signature" className="border rounded" />
                  </div>
                )}
                {response.selfie_url && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Selfie:</p>
                    <img src={response.selfie_url} alt="Selfie" className="border rounded w-48 h-48 object-cover" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### 5.4 SelfieCapture

**Purpose**: Capture selfie using device camera.

**File**: `components/inspections/selfie-capture.tsx`

```typescript
"use client"

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera } from 'lucide-react'

export function SelfieCapture({
  onCapture
}: {
  onCapture: (imageUrl: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [captured, setCaptured] = useState(false)

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setStream(mediaStream)
    } catch (error) {
      console.error('Camera access denied:', error)
      alert('Please allow camera access to capture selfie')
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(video, 0, 0)

    const imageUrl = canvas.toDataURL('image/png')
    onCapture(imageUrl)
    setCaptured(true)

    // Stop camera
    stream?.getTracks().forEach(track => track.stop())
  }

  const retake = () => {
    setCaptured(false)
    startCamera()
  }

  return (
    <div className="space-y-4">
      {!stream && !captured && (
        <Button onClick={startCamera} variant="outline">
          <Camera className="w-4 h-4 mr-2" />
          Start Camera
        </Button>
      )}

      {stream && !captured && (
        <div className="space-y-2">
          <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm border rounded" />
          <Button onClick={capturePhoto}>Capture Selfie</Button>
        </div>
      )}

      {captured && (
        <div className="space-y-2">
          <canvas ref={canvasRef} className="w-full max-w-sm border rounded" />
          <Button onClick={retake} variant="outline">Retake</Button>
        </div>
      )}
    </div>
  )
}
```

### 5.5 DraftIndicator & FormProgress

**Purpose**: Show save status and completion progress.

**File**: `components/inspections/draft-indicator.tsx`

```typescript
"use client"

import { CheckCircle, Clock } from 'lucide-react'

export function DraftIndicator({ lastSaved }: { lastSaved?: Date }) {
  if (!lastSaved) return null

  const timeAgo = Math.floor((Date.now() - lastSaved.getTime()) / 1000)
  const display = timeAgo < 60 ? 'Just now' : `${Math.floor(timeAgo / 60)}m ago`

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span>Draft saved {display}</span>
    </div>
  )
}
```

---

## 6. Offline Support (Future Consideration)

**Not implemented in MVP**, but architecture to support:

1. **IndexedDB for Local Storage**:
   - Store form fields and draft responses locally
   - Use `localforage` or `Dexie.js` library

2. **Service Worker for Sync**:
   - Queue submissions when offline
   - Sync when back online using Background Sync API

3. **Conflict Resolution**:
   - Last-write-wins strategy
   - Show warning if inspection was modified by another user

**Implementation Estimate**: 2-3 weeks (post-MVP)

---

## 7. API Endpoints

### New/Modified Endpoints

| Method | Path | Purpose | Auth Required |
|--------|------|---------|---------------|
| **GET** | `/api/inspections/[id]` | Get inspection with form fields | inspector, nurse, admin, owner |
| **POST** | `/api/inspections/[id]/responses` | Create/update draft response | inspector, nurse |
| **POST** | `/api/inspections/[id]/submit` | Submit final response | inspector, nurse |
| **GET** | `/api/inspections/[id]/responses/[responseId]` | Get submitted response | inspector (own), admin, owner |
| **POST** | `/api/inspections/[id]/selfie` | Upload selfie image | inspector, nurse |
| **POST** | `/api/inspections/[id]/field-photo` | Upload field photo | inspector, nurse |

### Example: Submit Inspection

**POST** `/api/inspections/[id]/submit`

**Request Body**:
```json
{
  "response_id": "uuid",
  "signature_data": "data:image/png;base64,...",
  "selfie_data": "data:image/png;base64,...",
  "field_responses": [
    {
      "field_id": "uuid",
      "value": false,
      "notes": "Extinguisher missing",
      "photo_urls": ["https://..."]
    },
    {
      "field_id": "uuid",
      "value": 120,
      "notes": null,
      "photo_urls": []
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "status": "failed",
  "failed_fields": [
    {
      "field_id": "uuid",
      "field_label": "Extinguisher Present",
      "passed": false,
      "is_critical": true,
      "fail_reason": "Extinguisher must be present"
    }
  ],
  "fail_reason": "Critical field(s) failed: Extinguisher Present"
}
```

---

## 8. Database Changes

Already defined in PLAN_01:
- `form_responses` table
- `form_field_responses` table

**Additional Columns** (for auto-fail logic):

```sql
-- Migration 007_form_response_enhancements.sql

ALTER TABLE form_fields
  ADD COLUMN is_critical BOOLEAN DEFAULT FALSE,
  ADD COLUMN validation_rules JSONB,
  ADD COLUMN fail_on_value JSONB;

-- Add index for critical fields
CREATE INDEX idx_form_fields_critical ON form_fields(is_critical) WHERE is_critical = TRUE;

-- Add photo storage bucket for field photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for inspection photos
CREATE POLICY "Users can upload inspection photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "Users can view inspection photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'inspection-photos');
```

---

## 9. Implementation Timeline

### Week 1: Database & Core Models
- [ ] Run migration `007_form_response_enhancements.sql`
- [ ] Create Supabase Storage bucket for inspection photos
- [ ] Build `evaluateFormResponse()` function with auto-fail logic
- [ ] Write unit tests for field evaluation

### Week 2: Form Renderer
- [ ] Build `FormRenderer` component
- [ ] Build `FieldInput` component (all field types)
- [ ] Build `PhotoUpload` component
- [ ] Add draft saving functionality
- [ ] Test with sample form template

### Week 3: Submission Flow
- [ ] Build submission modal with signature + selfie
- [ ] Implement `SelfieCapture` component
- [ ] Build API endpoint for `/api/inspections/[id]/submit`
- [ ] Integrate auto-fail evaluation
- [ ] Test end-to-end submission

### Week 4: Response Viewing
- [ ] Build `ResponseModal` component
- [ ] Add print-friendly CSS
- [ ] Build PDF export function
- [ ] Integrate modal into dashboard "Recent Inspections" table
- [ ] Test viewing responses as different roles

### Week 5: Admin Config & Polish
- [ ] Build field editor for validation rules
- [ ] Build field editor for fail conditions
- [ ] Add critical field toggle
- [ ] Test admin configuring thresholds
- [ ] End-to-end testing with real form templates
- [ ] Performance testing with large forms (50+ fields)

---

## 10. Future Enhancements

1. **Offline Support**: IndexedDB + Service Worker for offline form completion
2. **Voice Notes**: Record audio notes for each field (accessibility + efficiency)
3. **Barcode Scanning**: Scan equipment barcodes to auto-fill serial numbers
4. **GPS Tagging**: Auto-capture GPS coordinates for inspection location verification
5. **Photo Annotations**: Draw on photos to mark issues (arrows, circles, text)
6. **Multi-Language Support**: Translate form fields for non-English inspectors
7. **AI Auto-Fill**: Use OCR to extract values from photos (e.g., read pressure gauge from photo)

---

## Summary

**New Inspection Flow**:
1. Inspector opens inspection → sees dynamic form from `form_fields`
2. Fills each field (checkbox, text, number, select, photo)
3. Saves draft (optional) → `form_responses.status = 'draft'`
4. Submits form → auto-fail logic evaluates responses
5. Signs + captures selfie → `form_responses.status = 'submitted'`
6. Inspection marked as passed/failed based on critical field evaluations

**Big Modal for Viewing**:
- Owner/Admin can view all submitted responses
- Inspector can view their own submissions
- Large modal (80% width) with all field values, signature, selfie
- Print-friendly layout for regulatory audits
- PDF export button

**Auto-Pass/Fail Logic**:
- Fields have `is_critical` flag + `fail_on_value` rules
- If critical field fails → entire inspection fails
- Admin configurable thresholds per form template
- Numeric range validation (e.g., 100-150 PSI)
- Boolean checks (e.g., extinguisher must be present)

**UI Components**:
- `FormRenderer` - dynamic form builder
- `FieldInput` - handles each field type
- `ResponseModal` - large modal for viewing responses
- `SelfieCapture` - camera capture component
- `DraftIndicator` - shows save status
- `FormProgress` - completion percentage

**Implementation**: 5 weeks (database → form renderer → submission → viewing → admin config).
