# Log System - Implementation Status & Roadmap

> Last updated: 2026-02-18

## Overview

The inspection app's log system digitizes 7 paper-based medical/compliance forms used in ambulatory surgery centers. Each form is stored as JSONB in the `log_entries` table with type-specific Zod validation.

---

## Architecture

### Data Flow
```
Page (server) -> Log Component (client) -> Table Component (client)
                      |                          |
                      v                          v
               POST /api/locations/[id]/logs    onChange(data)
                      |
                      v
               log_entries table (JSONB)
```

### Key Files
| File | Purpose |
|------|---------|
| `lib/validations/log-entry.ts` | All 7 Zod schemas, types, empty helpers, preset data |
| `lib/server/services/log-entries.ts` | Upsert/filter service functions |
| `app/api/locations/[locationId]/logs/route.ts` | GET (list) + POST (upsert) API |
| `app/api/locations/[locationId]/logs/[logId]/route.ts` | GET single entry |
| `app/api/locations/[locationId]/logs/signature-url/route.ts` | Signed URL for stored signatures |
| `components/signature-identification.tsx` | Shared signature table component |
| `components/fullscreen-signature-pad.tsx` | Full-screen signature capture overlay |
| `app/(protected)/logs/narcotic/_components/signature-cell.tsx` | Inline signature cell (legacy pattern) |

### Storage Pattern
- Log data stored as JSONB in `log_entries.data` column
- Keyed by `log_type` + `log_key` (e.g., `"daily_narcotic_count"` + `"2026-02"`)
- Status: `draft` | `complete`
- Signature images: base64 in JSONB (small sigs) or Supabase Storage paths (large sigs)

---

## Log Form Status (7 of 7 Implemented)

### 1. Daily Narcotic Log (`narcotic_log`)
**Path**: `/logs/narcotic`
**Components**: `narcotic-log.tsx`, `narcotic-table.tsx`, `narcotic-summary.tsx`
**Key**: Date-based (`YYYY-MM-DD`)

| Feature | Status |
|---------|--------|
| Data entry table (12 rows default, expandable to 50) | Done |
| Drug columns: Versed, Fentanyl, custom Drug 3 | Done |
| Beginning/end counts | Done |
| Per-row dual signatures (sig1 + sig2) via SignatureCell | Done |
| Header + footer signatures | Done |
| Summary view (read-only compact table) | Done |
| Draft/Complete status | Done |
| Date navigation (client-side fetch) | Done |

**Signature pattern**: Direct `SignatureCell` usage (header, footer, per-row). NOT migrated to shared component.

---

### 2. Controlled Substance Inventory (`controlled_substance_inventory`)
**Path**: `/logs/inventory`
**Components**: `inventory-ledger.tsx`, `inventory-table.tsx`, `inventory-summary.tsx`, `drug-selector.tsx`
**Key**: Drug slug (e.g., `"versed"`, `"fentanyl"`, `"ephedrine"`)

| Feature | Status |
|---------|--------|
| Perpetual ledger per drug (20 rows default, expandable to 200) | Done |
| Drug selector (3 presets + custom) | Done |
| Columns: date, patient, transaction, qty, ordered, used, wasted | Done |
| Per-row dual signatures (RN + witness) via SignatureCell | Done |
| Summary view | Done |
| Drug-level navigation (tabs) | Done |

**Signature pattern**: Direct `SignatureCell` per row (rn_sig + witness_sig). NOT migrated to shared component.

---

### 3. Crash Cart Monthly Checklist (`crash_cart_checklist`)
**Path**: `/logs/crash-cart`
**Components**: `crash-cart-log.tsx`, `crash-cart-table.tsx`, `crash-cart-top.tsx`
**Key**: Year (e.g., `"2026"`)

| Feature | Status |
|---------|--------|
| Year-long grid: items x 12 months | Done |
| Par + Exp columns | Done |
| Section headers (6 drawers) | Done |
| Top of Cart items checklist | Done |
| Completed-by initials row | Done |
| Year selector dropdown | Done |
| 6-row signature table (name/signature/initials) | Done |
| Sticky left column | Done |

**Signature pattern**: Direct `SignatureCell` in crash-cart-top.tsx (6 signature rows). NOT migrated to shared component.

---

### 4. Narcotic Sign-out Form (`narcotic_signout`)
**Path**: `/logs/narcotic-signout`
**Components**: `narcotic-signout-log.tsx`, `narcotic-signout-table.tsx`
**Key**: Date-based (`YYYY-MM-DD`)

| Feature | Status |
|---------|--------|
| 5 drug columns (Fentanyl 250/100, Midazolam 5/2, custom) | Done |
| Per-drug header signatures (anesthesiologist + nurse) | Done |
| 5 case rows with administered/wasted per drug | Done |
| Per-case co-signature | Done |
| Total qty used + end balance rows | Done |
| Footer RN signature | Done |
| Anesthesia MD / Print Name fields | Done |

**Signature pattern**: Direct `SignatureCell` throughout. Complex multi-location signature usage. NOT migrated to shared component.

---

### 5. Daily Narcotic Count (`daily_narcotic_count`)
**Path**: `/logs/narcotic-count`
**Components**: `narcotic-count-log.tsx`, `narcotic-count-table.tsx`
**Key**: Year-month (`YYYY-MM`)

| Feature | Status |
|---------|--------|
| Monthly overview with max 4 date columns per set (wraps to new rows) | Done |
| 3 drugs: Fentanyl, Midazolam, Ephedrine | Done |
| AM / Rcvd+Used (diagonal split) / PM per drug per date | Done |
| Initials row: AM (2 stacked) + PM (2 stacked) per date | Done |
| Initials as select dropdown from signature entries | Done |
| Add/remove date columns (max 31) | Done |
| Date range picker (shadcn Calendar) | Done |
| Signature Identification (8 rows, shared component) | Done |
| "Apply My Signature" button | Done |
| Summary view (compact read-only) | Done |
| Month navigation (client-side) | Done |

**Signature pattern**: Uses shared `SignatureIdentification` component (first adopter).

---

### 6. Cardiac Arrest Record (`cardiac_arrest_record`)
**Path**: `/logs/cardiac-arrest`
**Components**: `cardiac-arrest-log.tsx`, `cardiac-arrest-table.tsx`
**Key**: Date-based (`YYYY-MM-DD`)

| Feature | Status |
|---------|--------|
| Header: admission diagnosis, history, initial signs | Done |
| Initial signs checkboxes (cyanosis, apnea, absence of pulse) | Done |
| Arrest date/time, page numbers | Done |
| Ventilation checkboxes (mouth-mask, bag-mask, bag-tube) | Done |
| Intubation fields (by, ETT size, time) | Done |
| Main table: 12 rows with 17 columns | Done |
| Drug columns: epinephrine, atropine, lidocaine, other | Done |
| Defibrillation: joules, rhythm pre/post | Done |
| IV drips: lidocaine, dopamine, dobutamine, other | Done |
| Footer: termination, outcome, transfer, neuro status | Done |
| Notification times (family, MD) | Done |
| Signature fields (text-only names, NO capture) | Done |
| Add/remove rows (max 50) | Done |

**Signature pattern**: Text inputs only (team_leader, recording_rn, respiratory_care, medication_rn, other_sig_1, other_sig_2). NO signature capture. **NEEDS UPGRADE** to use `SignatureIdentification` component with actual signature capture.

---

### 7. Crash Cart Daily Checklist (`crash_cart_daily`)
**Path**: `/logs/crash-cart-daily`
**Components**: `crash-cart-daily-log.tsx`, `crash-cart-daily-table.tsx`
**Key**: Year-month (`YYYY-MM`)

| Feature | Status |
|---------|--------|
| 31-day grid (days as columns) | Done |
| 7 check items (AED, pads, suction, O2, CPR board, supplies, lock) | Done |
| 3-row lock digit section (merged label) | Done |
| Initials row | Done |
| Notes column per item | Done |
| Lock change tracking (4 entries, 2x2 grid) | Done |
| Name/Signature/Initials table (4 rows, 2 columns) | Done |
| Bottom notes textarea | Done |
| Bottom info labels (AED unit, pad/cable, supplies, seal) | Done |
| Sticky left column | Done |

**Signature pattern**: Direct `SignatureCell` in table (4 signature rows). Can be migrated to shared component.

---

## Recent Changes (2026-02-18)

### Profile-Based Signature System
A foundational change that enables one-click signing across all log forms.

**New Files Created**:
| File | Purpose |
|------|---------|
| `supabase/migrations/20260218_profile_signature.sql` | Adds `signature_image` + `default_initials` to profiles table |
| `app/api/users/me/signature/route.ts` | GET/PUT API for profile signature management |
| `components/signature-identification.tsx` | Shared reusable signature identification component |
| `app/(protected)/settings/_components/my-signature-card.tsx` | Settings card for users to manage their signature |

**Modified Files**:
| File | Change |
|------|--------|
| `lib/server/auth-helpers.ts` | Profile interface + getProfile query: added `signature_image`, `default_initials` |
| `lib/server/services/locations.ts` | TeamMember interface + getTeamMembers query: added `signature_image`, `default_initials` |
| `app/(protected)/settings/_components/settings-content.tsx` | Added MySignatureCard to bento grid |
| `app/(protected)/settings/page.tsx` | Passes profile signature data to SettingsContent |
| `app/(protected)/logs/narcotic-count/_components/narcotic-count-log.tsx` | Replaced inline signature table with shared `SignatureIdentification` component |

### Previous Session Changes (2026-02-17/18)
- Narcotic count table: max 4 columns per set with wrapping
- Initials split into AM/PM with 2 stacked inputs each
- Date range picker using shadcn Calendar
- Summary view for narcotic count
- Sticky column background fixes (solid `bg-muted` instead of semi-transparent)
- Crash cart daily table: sticky column backgrounds fixed

---

## Pending Migration

The following SQL migration needs to be run against the Supabase instance:

```sql
-- File: supabase/migrations/20260218_profile_signature.sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signature_image TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_initials TEXT DEFAULT NULL;
```

---

## Roadmap: Next Steps

### Priority 1: Cardiac Arrest Form Enhancement
The cardiac arrest form currently uses text-only inputs for signatures. It needs:

1. **Schema update**: Change `team_leader`, `recording_rn`, `respiratory_care`, `medication_rn`, `other_sig_1`, `other_sig_2` from plain text to structured signature objects (name + signature image + initials)
2. **Add `SignatureIdentification` component**: Replace the 6 text inputs with the shared component (6 rows, 2 columns)
3. **Backward compatibility**: Parse old text-only data and display in name field of new signature format
4. **Time fields**: Consider adding time pickers for arrest_time, time_cpr_begun, intubation_time, termination_time (currently text inputs)
5. **Checkbox improvements**: Initial signs and ventilation checkboxes could use better mobile UX

### Priority 2: Migrate Remaining Forms to Shared SignatureIdentification
These forms still use inline `SignatureCell` directly and should be migrated:

| Form | Current Sigs | Migration Effort |
|------|-------------|-----------------|
| Crash Cart Daily | 4 rows (name/sig/initials) | Low - already has matching signature array structure |
| Crash Cart Monthly | 6 rows (name/sig/initials) in crash-cart-top.tsx | Low - same pattern |
| Narcotic Sign-out | Complex (header per drug + per case + footer) | Medium - different structure, may need custom layout |
| Narcotic Log | Header + footer + per-row (2 each) | High - per-row sigs don't fit the "identification table" pattern |
| Inventory | Per-row (RN + witness, 20 rows) | High - per-row sigs, different pattern |

**Recommendation**: Migrate Crash Cart Daily and Monthly first (low effort, same pattern). Leave Narcotic Log and Inventory as-is since their per-row signatures serve a different purpose than an "identification table."

### Priority 3: Location-Scoped Log Configuration
Currently all 7 log types are hardcoded and visible to every location. These forms are specific to **South Loop Endoscopy Center** (`c1efeb42-6cec-431e-9630-c1af7158e59d`) and should not appear at other locations.

**Requirements**:
1. **South Loop as primary location**: Mark as the "main" location that cannot be deleted. Add an `is_primary` or `is_protected` boolean flag to the `locations` table.
2. **Location-specific log types**: New `location_log_types` join table that controls which log types are available per location:
   ```sql
   CREATE TABLE location_log_types (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
     log_type TEXT NOT NULL,
     enabled BOOLEAN NOT NULL DEFAULT true,
     sort_order INTEGER NOT NULL DEFAULT 0,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (location_id, log_type)
   );
   ```
3. **Seed South Loop**: Insert all 7 log types for South Loop on migration.
4. **UI changes**:
   - Logs index page (`/logs/page.tsx`) queries `location_log_types` to show only enabled logs
   - Admin settings: toggle which log types are enabled per location
   - Prevent deletion of South Loop if `is_protected = true`
5. **Future**: Allow creating custom log types per location (log type templates).

**Alternative (simpler MVP)**: Add a `log_types` JSON array column on `locations` table instead of a join table. South Loop gets all 7, new locations start empty, admins toggle from settings.

### Priority 5: Signature Upload Optimization
Currently signatures in the new `SignatureIdentification` component are stored as base64 strings directly in JSONB. For better performance:

1. **API upload handler**: Extend the logs POST route to detect base64 in `signatures[]` array and upload to Supabase Storage
2. **Signed URL loading**: SignatureCell already handles this for storage paths
3. **Size reduction**: Consider compressing signature PNGs before storing

### Priority 6: One-Click Signing UX Improvements
1. **Profile dropdown in initials**: Instead of just "Apply My Signature", allow selecting any team member from a dropdown to fill in their info
2. **Auto-detect logged-in user**: When opening a form, auto-suggest the current user's initials
3. **Signature verification**: Visual indicator showing which signatures are profile-verified vs. manually entered

---

## Database Schema Reference

### log_entries table
```sql
CREATE TABLE log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  log_type TEXT NOT NULL,
  log_key TEXT NOT NULL DEFAULT '',
  log_date DATE NOT NULL,
  data JSONB NOT NULL,
  submitted_by_profile_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, log_type, log_key)
);
```

### profiles table (signature columns)
```sql
-- Added 2026-02-18
ALTER TABLE profiles
  ADD COLUMN signature_image TEXT DEFAULT NULL,    -- Base64 PNG
  ADD COLUMN default_initials TEXT DEFAULT NULL;    -- 2-5 chars
```

### Signature Data Shapes in JSONB

**SignatureIdentification pattern** (narcotic count, crash cart daily):
```json
{
  "signatures": [
    { "name": "Jane Doe", "signature": "data:image/png;base64,...", "initials": "JD" },
    { "name": "", "signature": null, "initials": "" }
  ]
}
```

**Per-row signature pattern** (narcotic log, inventory):
```json
{
  "rows": [
    { "patient": "...", "sig1": "data:image/png;base64,...", "sig2": null }
  ]
}
```

**Header/footer signature pattern** (narcotic log):
```json
{
  "header_sig1": "data:image/png;base64,...",
  "end_sig1": "data:image/png;base64,..."
}
```
