# Migration Plan: UUID to Simple Prefixed IDs

## Overview

Migrate `inspection_templates` and `inspection_instances` from UUIDs to human-readable prefixed integer IDs.

**Format:**
- Templates: `tmpl_1`, `tmpl_2`, `tmpl_3`...
- Instances: `insp_1`, `insp_2`, `insp_3`...

## Affected Tables

| Table | Change |
|-------|--------|
| `inspection_templates` | `id` UUID → TEXT (prefixed int) |
| `inspection_instances` | `id` UUID → TEXT, `template_id` UUID → TEXT |
| `inspection_signatures` | `inspection_instance_id` UUID → TEXT |
| `inspection_events` | `inspection_instance_id` UUID → TEXT |

## Migration Strategy

### Phase 1: Add New ID Columns

Add new columns alongside existing UUIDs:
- `inspection_templates.new_id` (TEXT)
- `inspection_instances.new_id` (TEXT)
- `inspection_instances.new_template_id` (TEXT)
- `inspection_signatures.new_instance_id` (TEXT)
- `inspection_events.new_instance_id` (TEXT)

### Phase 2: Create Sequences

```sql
CREATE SEQUENCE template_id_seq START 1;
CREATE SEQUENCE instance_id_seq START 1;
```

### Phase 3: Populate New IDs

```sql
-- Templates: generate tmpl_N for existing rows
UPDATE inspection_templates
SET new_id = 'tmpl_' || nextval('template_id_seq');

-- Instances: generate insp_N for existing rows
UPDATE inspection_instances
SET new_id = 'insp_' || nextval('instance_id_seq');

-- Update FK references
UPDATE inspection_instances i
SET new_template_id = t.new_id
FROM inspection_templates t
WHERE i.template_id = t.id;

UPDATE inspection_signatures s
SET new_instance_id = i.new_id
FROM inspection_instances i
WHERE s.inspection_instance_id = i.id;

UPDATE inspection_events e
SET new_instance_id = i.new_id
FROM inspection_instances i
WHERE e.inspection_instance_id = i.id;
```

### Phase 4: Swap Columns

1. Drop old FK constraints
2. Drop old columns
3. Rename new columns to original names
4. Add new FK constraints
5. Update indexes

### Phase 5: Create ID Generation Functions

```sql
CREATE OR REPLACE FUNCTION generate_template_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'tmpl_' || nextval('template_id_seq');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_instance_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'insp_' || nextval('instance_id_seq');
END;
$$ LANGUAGE plpgsql;
```

Set as column defaults.

---

## Code Changes Required

### 1. Validation Schemas

Update Zod schemas to accept prefixed IDs instead of UUIDs:

```typescript
// Before
z.string().uuid()

// After
const templateIdSchema = z.string().regex(/^tmpl_\d+$/, "Invalid template ID")
const instanceIdSchema = z.string().regex(/^insp_\d+$/, "Invalid instance ID")
```

### 2. TypeScript Types

Update all `Template` and `Instance` interfaces:
- `id: string` (no change to type, just the format)
- `template_id: string` (no change to type)

### 3. API Routes

Update parameter validation in:
- `/api/locations/[locationId]/templates/[templateId]`
- `/api/locations/[locationId]/instances/[instanceId]`
- `/api/locations/[locationId]/instances/[instanceId]/sign`
- `/api/locations/[locationId]/instances/[instanceId]/events`

### 4. Frontend Components

Update any places that display or construct IDs.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/007_simple_ids.sql` | **New** - Full migration |
| `lib/validations/template.ts` | Update ID validation |
| `lib/validations/instance.ts` | Update ID validation |
| `lib/server/services/templates.ts` | Type already `string`, no change |
| `lib/server/services/instances.ts` | Type already `string`, no change |
| `app/api/.../[templateId]/route.ts` | Update param validation |
| `app/api/.../[instanceId]/route.ts` | Update param validation |

---

## Rollback Plan

Keep old UUID columns for 1 week post-migration, then drop in follow-up migration.

---

## Testing Checklist

- [ ] Create new template → gets `tmpl_N` ID
- [ ] Create new instance → gets `insp_N` ID
- [ ] Existing templates accessible by new ID
- [ ] Existing instances accessible by new ID
- [ ] Signatures link correctly to instances
- [ ] Events link correctly to instances
- [ ] Dashboard queries work
- [ ] Inspection detail page loads
- [ ] Sign inspection works
