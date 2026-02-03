# Automatic Inspection Instance Generation

This document describes the automatic instance generation system for template-based inspections.

## Overview

The system automatically generates inspection instances based on templates with defined frequencies. This ensures that recurring inspections are always scheduled without manual intervention.

## Components

### 1. Date Calculation Helper (`lib/server/services/instances.ts`)

**Function**: `calculateNextDueDate(frequency)`

Calculates the next due date based on inspection frequency:

- **Weekly**: Next Monday from today
- **Monthly**: 1st of next month
- **Yearly**: January 1st of next year
- **Every 3 years**: January 1st, 3 years from now

All dates are set to midnight (00:00:00) in the server timezone.

**Example usage**:
```typescript
import { calculateNextDueDate } from "@/lib/server/services/instances"

const dueDate = calculateNextDueDate("weekly")
console.log(dueDate.toISOString()) // Next Monday at 00:00:00
```

### 2. Initial Instance Generation (`lib/server/services/templates.ts`)

**Enhancement**: `createTemplate()` now automatically generates the first instance

When a template is created with `active: true`, the system automatically:
1. Calculates the next due date based on frequency
2. Creates an initial inspection instance
3. Assigns the instance using the template's default assignee

If instance creation fails, the template is still created successfully (instance generation can be retried by the cron job).

**Example**:
```typescript
// Creating a weekly inspection template
const template = await createTemplate(locationId, userId, {
  task: "Kitchen Safety Check",
  frequency: "weekly",
  default_assignee_email: "inspector@example.com",
})
// → First instance automatically created with due_at = next Monday
```

### 3. Cron Job for Ongoing Generation (`app/api/cron/generate-instances/route.ts`)

**Endpoint**: `POST /api/cron/generate-instances`

**Schedule**: Daily at midnight (00:00 UTC) - configured in `vercel.json`

**Authentication**: Requires `CRON_SECRET` in Authorization header

**Logic**:
1. Fetches all active templates
2. For each template, checks if there's already a pending or in_progress instance
3. If no pending/in_progress instance exists, generates the next one
4. Returns summary of generated, skipped, and failed instances

**Response format**:
```json
{
  "generated": 5,
  "skipped": 12,
  "errors": 0,
  "timestamp": "2026-02-03T00:00:00.000Z"
}
```

**Error handling**:
- Individual template failures don't stop the entire job
- Errors are logged to console and counted in response
- Failed generations can be retried on next cron run

### 4. Vercel Cron Configuration (`vercel.json`)

Two cron jobs are configured:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 8 * * *"  // Daily at 8 AM UTC
    },
    {
      "path": "/api/cron/generate-instances",
      "schedule": "0 0 * * *"  // Daily at midnight UTC
    }
  ]
}
```

## Workflow

### Creating a New Template

```
User creates template
    ↓
createTemplate() called
    ↓
Template saved to database
    ↓
If active → calculateNextDueDate()
    ↓
First instance created automatically
    ↓
Template returned to user
```

### Daily Instance Generation

```
Cron job triggers at midnight
    ↓
Fetch all active templates
    ↓
For each template:
    ├─ Check for pending/in_progress instances
    ├─ If exists → skip (already has upcoming inspection)
    └─ If none → generate next instance
    ↓
Return summary stats
```

## Database Queries

### Check for existing instances
```sql
SELECT id, status
FROM inspection_instances
WHERE template_id = $1
  AND status IN ('pending', 'in_progress')
LIMIT 1
```

### Generate new instance
```sql
INSERT INTO inspection_instances (
  template_id,
  location_id,
  due_at,
  assigned_to_profile_id,
  assigned_to_email,
  status,
  created_by
) VALUES (
  $1, $2, $3, $4, $5, 'pending', 'system'
)
```

## Environment Variables

Required for cron jobs:

```env
CRON_SECRET=<random-secret-string>
```

This secret must be included in the Authorization header:
```
Authorization: Bearer <CRON_SECRET>
```

## Testing

### Manual Cron Trigger

You can manually trigger the cron job for testing:

```bash
curl -X POST https://your-app.vercel.app/api/cron/generate-instances \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Local Testing

For local development, you can call the endpoint directly:

```bash
curl -X POST http://localhost:3000/api/cron/generate-instances \
  -H "Authorization: Bearer your-local-secret"
```

## Edge Cases

### Multiple Pending Instances
The system only generates a new instance if there are no pending or in_progress instances for a template. This prevents duplicate upcoming inspections.

### Failed Instance Creation
If an instance fails to create during template creation, the template is still saved successfully. The cron job will attempt to generate the instance on its next run.

### Timezone Considerations
All dates are calculated in the server timezone. Weekly inspections use Monday as the start of the week (ISO 8601 standard).

### Template Deactivation
When a template is deactivated (`active: false`), the cron job skips it and no new instances are generated. Existing instances remain unchanged.

## Monitoring

Monitor the cron job performance through:

1. **Vercel Logs**: Check execution logs in Vercel dashboard
2. **Response Stats**: Monitor `generated`, `skipped`, and `errors` counts
3. **Database**: Query instance counts per template to verify generation

Example monitoring query:
```sql
SELECT
  t.task,
  t.frequency,
  COUNT(i.id) as instance_count,
  MAX(i.due_at) as latest_due_date
FROM inspection_templates t
LEFT JOIN inspection_instances i ON t.id = i.template_id
WHERE t.active = true
GROUP BY t.id, t.task, t.frequency
ORDER BY latest_due_date DESC NULLS FIRST
```

## Future Enhancements

Potential improvements:

1. **Smart scheduling**: Consider business hours and holidays
2. **Batch notifications**: Send digest of upcoming inspections
3. **Adaptive frequency**: Adjust frequency based on failure patterns
4. **Instance pre-generation**: Generate instances further in advance for better planning
5. **Custom due rules**: Support template-specific `default_due_rule` logic
