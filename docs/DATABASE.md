# Database Schema

## Overview

Supabase Postgres with RLS enabled on all tables. Better Auth manages user/session tables; application tables handle inspections.

---

## Better Auth Tables (Auto-Generated)

Run `npx @better-auth/cli migrate` to create:

| Table | Purpose |
|-------|---------|
| `user` | User accounts (id, name, email) |
| `session` | Active sessions (token, expires_at) |
| `account` | Auth providers (credentials) |
| `verification` | Email verification tokens |

---

## Application Tables

### 1. `locations`

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'inspector'
    CHECK (role IN ('owner', 'admin', 'nurse', 'inspector')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### 3. `profile_locations` (join table)

```sql
CREATE TABLE profile_locations (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, location_id)
);
```

### 4. `inspection_templates`

```sql
CREATE TABLE inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  task TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL
    CHECK (frequency IN ('weekly', 'monthly', 'yearly', 'every_3_years')),
  default_assignee_profile_id UUID REFERENCES profiles(id),
  default_due_rule JSONB,  -- e.g., {"day_of_week": "monday", "day_of_month": 1}
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5. `inspection_instances`

```sql
CREATE TABLE inspection_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES inspection_templates(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  due_at TIMESTAMPTZ NOT NULL,
  assigned_to_profile_id UUID REFERENCES profiles(id),
  assigned_to_email TEXT,  -- denormalized for emailing
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'failed', 'passed', 'void')),
  remarks TEXT,
  inspected_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  passed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6. `inspection_signatures`

```sql
CREATE TABLE inspection_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_instance_id UUID NOT NULL REFERENCES inspection_instances(id),
  signed_by_profile_id UUID NOT NULL REFERENCES profiles(id),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_image_path TEXT NOT NULL,  -- Supabase Storage path
  signature_points JSONB,              -- raw points for re-rendering
  device_meta JSONB                    -- user agent, screen size
);
```

### 7. `inspection_events` (immutable audit log)

```sql
CREATE TABLE inspection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_instance_id UUID NOT NULL REFERENCES inspection_instances(id),
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'created', 'assigned', 'started', 'failed', 'passed',
      'signed', 'comment', 'reminder_sent', 'escalated'
    )),
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_profile_id UUID REFERENCES profiles(id),  -- NULL for system/cron
  payload JSONB
);

-- NEVER UPDATE or DELETE rows in this table
```

### 8. `invite_codes`

```sql
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INT NOT NULL DEFAULT 1,
  uses INT NOT NULL DEFAULT 0,
  role_grant TEXT NOT NULL DEFAULT 'inspector',
  location_id UUID NOT NULL REFERENCES locations(id),
  assigned_email TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);
```

### 9. `notification_outbox`

```sql
CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('reminder', 'overdue', 'escalation')),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error TEXT
);
```

---

## Indexes

```sql
-- Instances: common query patterns
CREATE INDEX idx_instances_location_status ON inspection_instances(location_id, status);
CREATE INDEX idx_instances_due_at ON inspection_instances(due_at);
CREATE INDEX idx_instances_assigned ON inspection_instances(assigned_to_profile_id);
CREATE INDEX idx_instances_template ON inspection_instances(template_id);

-- Templates
CREATE INDEX idx_templates_location ON inspection_templates(location_id);
CREATE INDEX idx_templates_active ON inspection_templates(active) WHERE active = true;

-- Events
CREATE INDEX idx_events_instance ON inspection_events(inspection_instance_id);
CREATE INDEX idx_events_type ON inspection_events(event_type);

-- Profile locations
CREATE INDEX idx_profile_locations_location ON profile_locations(location_id);
CREATE INDEX idx_profile_locations_profile ON profile_locations(profile_id);

-- Invite codes
CREATE INDEX idx_invite_codes_location ON invite_codes(location_id);

-- Notification outbox
CREATE INDEX idx_outbox_status ON notification_outbox(status) WHERE status = 'queued';
```

---

## RLS Policies

Enable RLS on all tables:

```sql
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
```

### Location-based access policy pattern

```sql
-- Users can read locations they're assigned to
CREATE POLICY "location_read" ON locations
  FOR SELECT
  USING (
    id IN (
      SELECT pl.location_id FROM profile_locations pl
      JOIN profiles p ON p.id = pl.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Users can read instances for their locations
CREATE POLICY "instance_read" ON inspection_instances
  FOR SELECT
  USING (
    location_id IN (
      SELECT pl.location_id FROM profile_locations pl
      JOIN profiles p ON p.id = pl.profile_id
      WHERE p.user_id = auth.uid()
    )
  );
```

Note: In MVP, most access is mediated by server endpoints using the service role key. RLS is the "last line of defense" for any direct Supabase access.

---

## Storage

### Signatures bucket

```
Bucket: signatures (private)
Path: {locationId}/{instanceId}/{profileId}-{timestamp}.png
```

- Once signed, disallow overwriting (immutable).
- Generate signed download URLs for viewing.
- Admin and owner roles can view all signatures for their locations.

---

## Audit Log Pattern

The `inspection_events` table is **append-only**:
- NEVER UPDATE existing rows
- NEVER DELETE rows
- Always INSERT new events for every state change
- System events (cron reminders) use `actor_profile_id = NULL`
- Include relevant data in `payload` JSONB for full audit trail
