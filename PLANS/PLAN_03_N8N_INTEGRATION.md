# PLAN_03: n8n Workflow Automation Integration

**Status**: Draft
**Created**: 2026-02-07
**Owner**: Engineering Team

---

## Executive Summary

Replace Vercel cron jobs with n8n workflow automation for:
- Flexible scheduling and retry logic
- Google Forms synchronization (see PLAN_02)
- Complex notification workflows
- External service integrations
- Better monitoring and error handling

**Current State:**
- Vercel cron: `/api/cron/reminders` (8 AM daily), `/api/cron/generate-instances` (midnight daily)
- Email: Resend via `notification_outbox` queue
- Push: Web Push API with VAPID
- Background tasks: Next.js `after()` for fire-and-forget operations

**Target State:**
- n8n handles all scheduled workflows
- Webhooks trigger n8n for real-time events
- Vercel cron kept as fallback (can be disabled)
- Same notification channels (Resend + Web Push)

---

## 1. n8n Deployment Strategy

### Option A: Self-Hosted (Recommended for MVP)

**Docker Compose setup:**
```yaml
# docker-compose.yml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://${N8N_HOST}
      - GENERIC_TIMEZONE=America/New_York
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=${DB_HOST}
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=${DB_NAME}
      - DB_POSTGRESDB_USER=${DB_USER}
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n
      - ./n8n/workflows:/home/node/.n8n/workflows
    networks:
      - n8n-network

volumes:
  n8n_data:

networks:
  n8n-network:
    driver: bridge
```

**Deployment:**
- **VPS**: DigitalOcean Droplet, AWS EC2, or similar
- **SSL**: Nginx reverse proxy with Let's Encrypt
- **Backups**: Daily backup of n8n Postgres DB + workflow exports
- **Monitoring**: Uptime Kuma or similar

### Option B: n8n Cloud

**Pros:**
- Managed service (no server maintenance)
- Built-in monitoring
- Auto-scaling

**Cons:**
- Monthly cost (~$20-50/month)
- Less control over environment

**Recommendation**: Start with self-hosted for MVP, migrate to Cloud if scaling needs increase.

---

## 2. Workflow Inventory

### 2.1 Core Notification Workflows

#### `daily-reminders`
**Replaces**: `/api/cron/reminders`
**Schedule**: Daily at 8:00 AM ET
**Trigger**: Cron (0 8 * * *)

**Steps:**
1. **Query Supabase**: Fetch pending/in_progress instances due within reminder windows
2. **Filter by settings**: Apply reminder rules from `reminder_settings` table
3. **Categorize**: Group by reminder type (overdue, due_today, upcoming, monthly_warning)
4. **Queue emails**: Insert into `notification_outbox` for each instance
5. **Send push notifications**: Call `/api/push/send` webhook for real-time alerts
6. **Process outbox**: Fetch queued notifications and send via Resend
7. **Update outbox**: Mark sent/failed in `notification_outbox`

**Output**: Summary report sent to admin

---

#### `daily-instance-generation`
**Replaces**: `/api/cron/generate-instances`
**Schedule**: Daily at midnight ET
**Trigger**: Cron (0 0 * * *)

**Steps:**
1. **Query templates**: Fetch all active templates
2. **Check existing**: For each template, query if pending/in_progress instance exists
3. **Calculate due date**: Based on frequency (weekly/monthly/yearly/every_3_years)
4. **Insert instance**: Create new row in `inspection_instances` if needed
5. **Log events**: Append to `inspection_events` for audit trail

**Output**: Summary (generated/skipped/errors) sent to admin

---

#### `escalation-digest`
**New workflow**
**Schedule**: Daily at 9:00 AM ET
**Trigger**: Cron (0 9 * * *)

**Steps:**
1. **Query overdue unassigned**: Fetch instances where status=overdue AND assigned_to_email IS NULL
2. **Group by location**: Aggregate counts and details
3. **Send digest email**: To OWNER_ESCALATION_EMAIL with actionable list
4. **Log event**: Record escalation in `inspection_events`

**Output**: Email with links to assign inspections

---

#### `assignment-notification`
**New workflow**
**Schedule**: Triggered by webhook
**Trigger**: Webhook (`POST /webhook/assignment-changed`)

**Webhook Payload:**
```json
{
  "instance_id": "uuid",
  "old_assignee_email": "user1@example.com",
  "new_assignee_email": "user2@example.com",
  "task": "Fire Extinguisher Check",
  "location_name": "Building A",
  "due_at": "2024-06-01T00:00:00Z"
}
```

**Steps:**
1. **Receive webhook**: Validate signature (HMAC-SHA256)
2. **Queue notification**: Insert into `notification_outbox` for new assignee
3. **Send push**: Call `/api/push/send` with profile_id
4. **Send email**: Process outbox immediately (don't wait for daily cron)

**Output**: Real-time notification to assignee

---

### 2.2 Google Sync Workflows

#### `google-forms-pull-sync`
**Schedule**: Every 15 minutes
**Trigger**: Cron (*/15 * * * *)

**Steps:**
1. **Fetch Google Sheet**: Use Google Sheets API node
2. **Filter new rows**: Check `last_sync_at` timestamp
3. **Map to instances**: Transform Google Forms data to inspection_instances schema
4. **Upsert instances**: Insert or update in Supabase
5. **Update sync timestamp**: Store last_sync_at in `sync_metadata` table
6. **Log results**: Record sync summary

**Google Sheets Node Config:**
```json
{
  "authentication": "serviceAccount",
  "serviceAccountEmail": "n8n-sync@project.iam.gserviceaccount.com",
  "spreadsheetId": "{{$env.GOOGLE_SHEET_ID}}",
  "sheetName": "Form Responses 1",
  "range": "A:Z"
}
```

**Output**: Sync summary logged to `sync_logs` table

---

#### `google-forms-push-sync`
**Schedule**: Triggered by webhook
**Trigger**: Webhook (`POST /webhook/inspection-completed`)

**Webhook Payload:**
```json
{
  "instance_id": "uuid",
  "status": "passed",
  "inspected_at": "2024-06-15T10:30:00Z",
  "remarks": "All clear",
  "signature_url": "https://..."
}
```

**Steps:**
1. **Receive webhook**: Validate signature
2. **Fetch instance details**: Query Supabase for full inspection data
3. **Map to Google Sheets format**: Transform to match form response schema
4. **Append to sheet**: Use Google Sheets API to add row
5. **Update sync status**: Mark instance as synced in `sync_metadata`

**Output**: Row added to Google Sheet

---

#### `google-forms-import`
**Schedule**: Manual trigger
**Trigger**: Webhook (`POST /webhook/import-google-forms`)

**Use Case**: One-time bulk import of historical data

**Steps:**
1. **Fetch all rows**: Read entire Google Sheet
2. **Deduplicate**: Check existing instances by external_id
3. **Batch insert**: Use Supabase batch insert (500 rows at a time)
4. **Error handling**: Log failed rows to `import_errors` table
5. **Send report**: Email admin with import summary

**Output**: Import summary with success/failure counts

---

### 2.3 Monitoring Workflows

#### `health-check`
**Schedule**: Every 5 minutes
**Trigger**: Cron (*/5 * * * *)

**Steps:**
1. **Ping app**: HTTP GET to `https://app.example.com/api/health`
2. **Check database**: Query Supabase connection
3. **Check n8n workflows**: Verify all workflows are active
4. **Alert on failure**: Send Slack/email if any check fails

**Output**: Uptime metrics

---

#### `sync-error-alert`
**Schedule**: Every 30 minutes
**Trigger**: Cron (*/30 * * * *)

**Steps:**
1. **Query failed syncs**: Check `sync_logs` for errors in last 30 minutes
2. **Alert if threshold exceeded**: Send email if >5 failures
3. **Include details**: Attach error logs and affected records

**Output**: Alert email to admin

---

#### `compliance-weekly-report`
**Schedule**: Weekly on Monday at 9:00 AM ET
**Trigger**: Cron (0 9 * * 1)

**Steps:**
1. **Query completed inspections**: Last 7 days
2. **Calculate metrics**: Completion rate, overdue count, failure rate
3. **Generate report**: HTML email with charts (use n8n Chart.js node)
4. **Attach CSV**: Export raw data for analysis
5. **Send to stakeholders**: Email owner + admins

**Output**: Weekly compliance report

---

## 3. Webhook Integration

### 3.1 Webapp → n8n Webhook Patterns

**Base URL**: `https://n8n.yourdomain.com/webhook/`

**Webhooks:**
- `POST /webhook/assignment-changed` - Trigger assignment-notification workflow
- `POST /webhook/inspection-completed` - Trigger google-forms-push-sync workflow
- `POST /webhook/import-google-forms` - Trigger google-forms-import workflow

### 3.2 Authentication

**HMAC-SHA256 signature** in `X-N8N-Signature` header:

```typescript
// lib/server/services/n8n-webhook.ts
import crypto from "crypto"

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET!

export function signWebhookPayload(payload: Record<string, unknown>): string {
  const body = JSON.stringify(payload)
  return crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex")
}

export async function sendN8NWebhook(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const signature = signWebhookPayload(payload)

  try {
    const response = await fetch(`${process.env.N8N_WEBHOOK_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-Signature": signature,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}
```

**n8n webhook validation** (Function node):
```javascript
// Verify HMAC signature
const crypto = require('crypto');
const receivedSignature = $request.headers['x-n8n-signature'];
const body = JSON.stringify($request.body);
const expectedSignature = crypto
  .createHmac('sha256', $env.N8N_WEBHOOK_SECRET)
  .update(body)
  .digest('hex');

if (receivedSignature !== expectedSignature) {
  throw new Error('Invalid signature');
}

return $request.body;
```

### 3.3 Webhook Payload Schemas

**assignment-changed:**
```typescript
interface AssignmentChangedPayload {
  instance_id: string
  old_assignee_email: string | null
  new_assignee_email: string | null
  old_assignee_profile_id: string | null
  new_assignee_profile_id: string | null
  task: string
  location_name: string
  due_at: string
  changed_by: string // user_id
  changed_at: string
}
```

**inspection-completed:**
```typescript
interface InspectionCompletedPayload {
  instance_id: string
  template_id: string
  location_id: string
  location_name: string
  task: string
  status: "passed" | "failed"
  inspected_at: string
  inspected_by_profile_id: string
  remarks: string | null
  signature_url: string | null
}
```

---

## 4. n8n ↔ Supabase Connection

### 4.1 Direct Postgres Connection (Recommended)

**n8n Credentials:**
- **Name**: Supabase Postgres
- **Type**: Postgres
- **Host**: `aws-0-[region].pooler.supabase.com`
- **Port**: `6543` (use connection pooler for stability)
- **Database**: `postgres`
- **User**: `postgres.[project-ref]`
- **Password**: Database password (NOT service role key)
- **SSL**: Enable (required for Supabase)

**Pros:**
- Direct SQL queries (faster)
- Batch operations
- Complex joins

**Cons:**
- Bypasses RLS (use service role credentials only in n8n)
- Must manually scope by `location_id`

### 4.2 Supabase REST API (Alternative)

**n8n HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "{{$env.SUPABASE_URL}}/rest/v1/inspection_instances",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "headers": {
    "apiKey": "{{$env.SUPABASE_SERVICE_KEY}}",
    "Authorization": "Bearer {{$env.SUPABASE_SERVICE_KEY}}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  },
  "body": {
    "template_id": "{{$json.template_id}}",
    "location_id": "{{$json.location_id}}",
    "due_at": "{{$json.due_at}}",
    "status": "pending"
  }
}
```

**Pros:**
- Uses Supabase REST API (same as client)
- Auto-enforces RLS if using anon key (not recommended for server workflows)

**Cons:**
- Limited to REST operations
- More HTTP overhead

**Recommendation**: Use Postgres node for complex queries, HTTP node for simple CRUD.

---

### 4.3 Common Query Patterns in n8n

**Fetch pending instances (Postgres node):**
```sql
SELECT
  ii.id,
  ii.due_at,
  ii.assigned_to_email,
  ii.assigned_to_profile_id,
  it.task,
  it.frequency,
  l.name AS location_name
FROM inspection_instances ii
JOIN inspection_templates it ON ii.template_id = it.id
JOIN locations l ON ii.location_id = l.id
WHERE ii.status IN ('pending', 'in_progress')
  AND ii.due_at <= NOW() + INTERVAL '{{$json.days_ahead}} days'
ORDER BY ii.due_at ASC
LIMIT 500;
```

**Insert into notification_outbox (Postgres node):**
```sql
INSERT INTO notification_outbox (type, to_email, subject, payload, status)
VALUES (
  '{{$json.type}}',
  '{{$json.to_email}}',
  '{{$json.subject}}',
  '{{$json.payload}}'::jsonb,
  'queued'
)
RETURNING id;
```

**Batch update instances (Postgres node):**
```sql
UPDATE inspection_instances
SET status = 'pending', assigned_to_email = data.email
FROM (VALUES
  ('uuid1'::uuid, 'user1@example.com'),
  ('uuid2'::uuid, 'user2@example.com')
) AS data(id, email)
WHERE inspection_instances.id = data.id;
```

---

## 5. Migration from Vercel Cron

### Phase 1: Shadow Mode (Week 1-2)

**Goal**: Run n8n workflows in parallel with Vercel cron to validate behavior.

**Steps:**
1. Deploy n8n (Docker Compose on VPS)
2. Import workflow JSON files (see Section 8)
3. Configure credentials (Supabase, Resend, Google)
4. Enable workflows with modified schedule (offset by 5 minutes)
5. Compare outputs (n8n logs vs Vercel logs)

**Example:**
- Vercel cron: 8:00 AM
- n8n workflow: 8:05 AM
- Compare: notification_outbox rows created by each

**Validation criteria:**
- Same instances identified
- Same emails queued
- No duplicate notifications sent

---

### Phase 2: n8n Takeover (Week 3)

**Goal**: Disable Vercel cron, n8n becomes primary.

**Steps:**
1. Update `vercel.json` to comment out cron jobs:
   ```json
   {
     "crons": [
       // { "path": "/api/cron/reminders", "schedule": "0 8 * * *" },
       // { "path": "/api/cron/generate-instances", "schedule": "0 0 * * *" }
     ]
   }
   ```
2. Redeploy to Vercel
3. Monitor n8n executions for 48 hours
4. Verify no missed reminders
5. Document any issues in `PLANS/PLAN_03_ISSUES.md`

---

### Phase 3: Cleanup (Week 4)

**Goal**: Remove Vercel cron code, keep as internal API endpoints for n8n.

**Steps:**
1. Refactor `/api/cron/reminders` to `/api/internal/process-reminders`
2. Keep CRON_SECRET for backward compatibility (n8n will use it)
3. Update n8n workflows to call internal API endpoints if needed
4. Archive old cron code in `_archive/` directory

**Rollback plan:**
- Re-enable Vercel cron by uncommenting `vercel.json`
- Disable n8n workflows
- Redeploy to Vercel

---

## 6. Environment & Configuration

### 6.1 n8n Environment Variables

**In n8n Docker Compose or Cloud settings:**
```bash
# n8n Core
N8N_USER=admin
N8N_PASSWORD=<secure-password>
N8N_HOST=n8n.yourdomain.com
WEBHOOK_URL=https://n8n.yourdomain.com

# Database (Supabase)
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...
DB_HOST=aws-0-[region].pooler.supabase.com
DB_NAME=postgres
DB_USER=postgres.[project-ref]
DB_PASSWORD=<db-password>

# Email (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=Inspection Tracker <notifications@yourdomain.com>

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=n8n-sync@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=<service-account-private-key>
GOOGLE_SHEET_ID=<spreadsheet-id>

# Webhook Security
N8N_WEBHOOK_SECRET=<webhook-hmac-secret>

# Push Notifications
VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
VAPID_SUBJECT=mailto:admin@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
OWNER_ESCALATION_EMAIL=owner@example.com
```

---

### 6.2 Webapp Environment Variables (Add to .env.local)

```bash
# n8n Integration
N8N_WEBHOOK_URL=https://n8n.yourdomain.com/webhook
N8N_WEBHOOK_SECRET=<same-as-n8n-secret>

# Keep existing variables
CRON_SECRET=<keep-for-backward-compatibility>
```

---

### 6.3 Google Service Account Setup

**Create service account:**
1. Go to Google Cloud Console
2. Create project: `inspection-app-sync`
3. Enable APIs: Google Sheets API, Google Drive API
4. Create service account: `n8n-sync@project.iam.gserviceaccount.com`
5. Generate JSON key
6. Share Google Sheet with service account email (Editor access)

**Extract credentials for n8n:**
```bash
# From service-account-key.json
SERVICE_ACCOUNT_EMAIL=<client_email>
PRIVATE_KEY=<private_key> # Keep \n as literal newlines
```

---

## 7. Error Handling

### 7.1 n8n Retry Policies

**Automatic retry** (configure in workflow settings):
```json
{
  "continueOnFail": false,
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 300000  // 5 minutes in ms
}
```

**Exponential backoff** (Function node):
```javascript
const attemptNumber = $execution.data.resultData.runData.$node['attempt'] || 1;
const waitTime = Math.min(1000 * Math.pow(2, attemptNumber), 60000); // Max 60s
await new Promise(resolve => setTimeout(resolve, waitTime));
```

---

### 7.2 Dead Letter Queue

**Supabase table:**
```sql
CREATE TABLE workflow_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  error_message TEXT NOT NULL,
  input_data JSONB NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_count INT NOT NULL DEFAULT 0,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_workflow_failures_unresolved
  ON workflow_failures(failed_at)
  WHERE resolved_at IS NULL;
```

**n8n Error Trigger workflow:**
1. Catch error from any workflow
2. Insert into `workflow_failures`
3. Send alert email if critical
4. Retry queue processor runs hourly to retry failed executions

---

### 7.3 Error Notification Workflow

**Trigger**: On workflow failure (n8n built-in trigger)

**Steps:**
1. **Capture error**: Extract error message and stack trace
2. **Log to database**: Insert into `workflow_failures`
3. **Check severity**: If critical workflow (reminders, instance-generation), send immediate alert
4. **Send Slack/email**: Notify admin with execution link
5. **Update metrics**: Increment error counter in monitoring system

**Alert threshold**: >5 failures in 1 hour = critical alert

---

### 7.4 Logging and Monitoring

**n8n execution logs:**
- Stored in n8n database (default retention: 30 days)
- Export to external logging (optional): Loki, CloudWatch, or Supabase

**Custom logging table:**
```sql
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  duration_ms INT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_status ON workflow_executions(status, executed_at);
```

**Monitoring dashboard** (query from workflow_executions):
- Success rate by workflow (last 24h)
- Average execution time
- Error count by type
- Retry success rate

---

## 8. Workflow JSON Templates

### 8.1 daily-reminders Workflow

**File**: `n8n/workflows/daily-reminders.json`

```json
{
  "name": "daily-reminders",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "cronExpression": "0 8 * * *"
            }
          ]
        }
      },
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT ii.id, ii.due_at, ii.assigned_to_email, ii.assigned_to_profile_id, ii.location_id, it.task, it.frequency, l.name AS location_name FROM inspection_instances ii JOIN inspection_templates it ON ii.template_id = it.id JOIN locations l ON ii.location_id = l.id WHERE ii.status IN ('pending', 'in_progress') AND ii.due_at <= NOW() + INTERVAL '6 months' ORDER BY ii.due_at ASC LIMIT 500;"
      },
      "name": "Query Pending Instances",
      "type": "n8n-nodes-base.postgres",
      "credentials": {
        "postgres": {
          "id": "1",
          "name": "Supabase Postgres"
        }
      },
      "position": [450, 300]
    },
    {
      "parameters": {
        "functionCode": "// Categorize instances by reminder type\nconst now = new Date();\nconst items = [];\n\nfor (const item of $input.all()) {\n  const dueAt = new Date(item.json.due_at);\n  const frequency = item.json.frequency;\n  \n  let reminderType = null;\n  \n  if (dueAt < now) {\n    reminderType = 'overdue';\n  } else {\n    const daysUntilDue = Math.floor((dueAt - now) / (1000 * 60 * 60 * 24));\n    \n    if (frequency === 'weekly' && daysUntilDue <= 0) {\n      reminderType = 'due_today';\n    } else if (frequency === 'monthly' && daysUntilDue <= 7) {\n      reminderType = 'upcoming';\n    } else if (frequency === 'yearly' && daysUntilDue <= 180) {\n      reminderType = 'monthly_warning';\n    }\n  }\n  \n  if (reminderType) {\n    items.push({\n      json: {\n        ...item.json,\n        reminder_type: reminderType\n      }\n    });\n  }\n}\n\nreturn items;"
      },
      "name": "Filter and Categorize",
      "type": "n8n-nodes-base.function",
      "position": [650, 300]
    },
    {
      "parameters": {
        "operation": "insert",
        "schema": "public",
        "table": "notification_outbox",
        "columns": "type,to_email,subject,payload,status",
        "options": {}
      },
      "name": "Queue Email Notifications",
      "type": "n8n-nodes-base.postgres",
      "credentials": {
        "postgres": {
          "id": "1",
          "name": "Supabase Postgres"
        }
      },
      "position": [850, 300]
    },
    {
      "parameters": {
        "url": "={{$env.NEXT_PUBLIC_APP_URL}}/api/push/send",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "name": "Send Push Notifications",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 450]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM notification_outbox WHERE status = 'queued' ORDER BY created_at ASC LIMIT 50;"
      },
      "name": "Fetch Queued Notifications",
      "type": "n8n-nodes-base.postgres",
      "credentials": {
        "postgres": {
          "id": "1",
          "name": "Supabase Postgres"
        }
      },
      "position": [1050, 300]
    },
    {
      "parameters": {
        "url": "https://api.resend.com/emails",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "from",
              "value": "={{$env.FROM_EMAIL}}"
            },
            {
              "name": "to",
              "value": "={{$json.to_email}}"
            },
            {
              "name": "subject",
              "value": "={{$json.subject}}"
            },
            {
              "name": "html",
              "value": "={{$json.html_body}}"
            }
          ]
        },
        "options": {}
      },
      "name": "Send Email via Resend",
      "type": "n8n-nodes-base.httpRequest",
      "credentials": {
        "httpHeaderAuth": {
          "id": "2",
          "name": "Resend API Key"
        }
      },
      "position": [1250, 300]
    },
    {
      "parameters": {
        "operation": "update",
        "table": "notification_outbox",
        "updateKey": "id",
        "columns": "status,sent_at",
        "options": {}
      },
      "name": "Mark as Sent",
      "type": "n8n-nodes-base.postgres",
      "credentials": {
        "postgres": {
          "id": "1",
          "name": "Supabase Postgres"
        }
      },
      "position": [1450, 300]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [[{ "node": "Query Pending Instances", "type": "main", "index": 0 }]]
    },
    "Query Pending Instances": {
      "main": [[{ "node": "Filter and Categorize", "type": "main", "index": 0 }]]
    },
    "Filter and Categorize": {
      "main": [
        [
          { "node": "Queue Email Notifications", "type": "main", "index": 0 },
          { "node": "Send Push Notifications", "type": "main", "index": 0 }
        ]
      ]
    },
    "Queue Email Notifications": {
      "main": [[{ "node": "Fetch Queued Notifications", "type": "main", "index": 0 }]]
    },
    "Fetch Queued Notifications": {
      "main": [[{ "node": "Send Email via Resend", "type": "main", "index": 0 }]]
    },
    "Send Email via Resend": {
      "main": [[{ "node": "Mark as Sent", "type": "main", "index": 0 }]]
    }
  }
}
```

**Key Configuration Parameters:**
- **Cron expression**: `0 8 * * *` (daily at 8 AM)
- **Batch limit**: 500 instances
- **Reminder window**: 6 months ahead for yearly/3-year inspections
- **Retry policy**: 3 attempts with 5-minute delays

---

### 8.2 google-forms-pull-sync Workflow

**File**: `n8n/workflows/google-forms-pull-sync.json`

**Key Nodes:**
1. **Schedule Trigger**: Every 15 minutes
2. **Get Last Sync Timestamp**: Query `sync_metadata` table
3. **Google Sheets Node**: Read new rows since last sync
4. **Transform Data**: Map Google Forms columns to inspection_instances schema
5. **Upsert to Supabase**: Insert or update via Postgres node
6. **Update Sync Timestamp**: Store current time in `sync_metadata`
7. **Log Results**: Insert summary into `sync_logs`

**SQL for upsert:**
```sql
INSERT INTO inspection_instances (
  id, template_id, location_id, due_at, status, remarks, external_id
)
VALUES (
  gen_random_uuid(),
  '{{$json.template_id}}',
  '{{$json.location_id}}',
  '{{$json.due_at}}',
  '{{$json.status}}',
  '{{$json.remarks}}',
  '{{$json.external_id}}'
)
ON CONFLICT (external_id)
DO UPDATE SET
  status = EXCLUDED.status,
  remarks = EXCLUDED.remarks,
  updated_at = NOW();
```

---

### 8.3 assignment-notification Workflow

**File**: `n8n/workflows/assignment-notification.json`

**Key Nodes:**
1. **Webhook Trigger**: `POST /webhook/assignment-changed`
2. **Verify Signature**: Function node with HMAC validation
3. **Queue Notification**: Insert into `notification_outbox`
4. **Send Push**: HTTP request to `/api/push/send`
5. **Send Email**: Immediate email via Resend (don't wait for cron)
6. **Log Event**: Insert into `inspection_events`

**Webhook response:**
```json
{
  "success": true,
  "notification_id": "uuid",
  "push_sent": true,
  "email_queued": true
}
```

---

## 9. Success Metrics

**KPIs to track after migration:**
- **Reliability**: 99.5% success rate for workflows
- **Latency**: Reminders sent within 5 minutes of schedule
- **Errors**: <1% failure rate on email/push delivery
- **Sync accuracy**: 100% consistency between Google Sheets and Supabase
- **Downtime**: <1 hour/month for n8n service

**Monitoring dashboard queries:**
```sql
-- Success rate by workflow (last 24h)
SELECT
  workflow_name,
  COUNT(*) FILTER (WHERE status = 'success') AS success_count,
  COUNT(*) FILTER (WHERE status = 'error') AS error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) AS success_rate_pct
FROM workflow_executions
WHERE executed_at >= NOW() - INTERVAL '24 hours'
GROUP BY workflow_name;

-- Average execution time
SELECT
  workflow_name,
  AVG(duration_ms) AS avg_duration_ms,
  MAX(duration_ms) AS max_duration_ms
FROM workflow_executions
WHERE executed_at >= NOW() - INTERVAL '7 days'
GROUP BY workflow_name;
```

---

## 10. Next Steps

### Week 1: Setup
- [ ] Provision VPS for n8n (DigitalOcean/AWS)
- [ ] Deploy n8n via Docker Compose
- [ ] Configure SSL with Nginx + Let's Encrypt
- [ ] Set up n8n credentials (Supabase, Resend, Google)

### Week 2: Build Workflows
- [ ] Import workflow JSON templates
- [ ] Test daily-reminders in isolation
- [ ] Test daily-instance-generation in isolation
- [ ] Validate outputs against Vercel cron

### Week 3: Shadow Mode
- [ ] Run n8n workflows parallel to Vercel cron
- [ ] Compare notification_outbox entries
- [ ] Fix any discrepancies
- [ ] Monitor for 72 hours

### Week 4: Migration
- [ ] Disable Vercel cron jobs
- [ ] Enable n8n as primary
- [ ] Monitor for 1 week
- [ ] Document any issues

### Week 5: Google Sync
- [ ] Implement google-forms-pull-sync
- [ ] Implement google-forms-push-sync
- [ ] Test with sample data
- [ ] Run one-time bulk import

### Week 6: Polish
- [ ] Set up monitoring dashboard
- [ ] Configure error alerting
- [ ] Document runbooks for common issues
- [ ] Train team on n8n UI

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| n8n downtime | High - no reminders sent | Keep Vercel cron as fallback (can re-enable in 5 minutes) |
| Webhook signature bypass | Medium - unauthorized triggers | Use HMAC-SHA256, rotate secret monthly |
| Google API rate limits | Low - sync delays | Implement exponential backoff, cache responses |
| Database connection pool exhaustion | Medium - failed queries | Use Supabase connection pooler (port 6543), limit concurrent workflows |
| n8n workflow versioning | Low - accidental changes | Export workflows to git after each change, enable n8n version control |

---

## 12. Appendix

### A. Glossary

- **n8n**: Open-source workflow automation platform (alternative to Zapier)
- **VAPID**: Voluntary Application Server Identification for Web Push
- **HMAC**: Hash-based Message Authentication Code for webhook security
- **RLS**: Row Level Security (Supabase feature)
- **DLQ**: Dead Letter Queue for failed messages

### B. References

- [n8n Documentation](https://docs.n8n.io)
- [Supabase REST API](https://supabase.com/docs/guides/api)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Resend API](https://resend.com/docs)
- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)

### C. Related Plans

- **PLAN_01**: Initial architecture (baseline)
- **PLAN_02**: Google Forms sync (integration details)
- **PLAN_04**: Scaling and optimization (future state)

---

**End of PLAN_03**
