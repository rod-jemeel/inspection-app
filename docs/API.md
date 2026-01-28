# API Endpoints

## Pattern

All location-scoped endpoints:
```
/api/locations/:locationId/[resource]
```

All endpoints must:
1. Verify authentication (Better Auth session)
2. Verify location access (profile_locations)
3. Check role permissions
4. Filter queries by `location_id`

---

## Auth

### `POST /api/auth/[...all]`
Better Auth catch-all handler. Handles sign-in, sign-out, session, etc.

### `POST /api/auth/invite`
Exchange invite code for session.

**Body:**
```json
{
  "code": "ABC12345",
  "name": "Inspector Name",
  "email": "inspector@example.com"
}
```

**Response:** `200` with session cookie set.

**Errors:** `400 INVALID_CODE`, `410 EXPIRED_CODE`, `409 CODE_EXHAUSTED`

---

## Locations

### `GET /api/locations`
List locations the authenticated user has access to.

**Response:**
```json
{ "data": [{ "id": "uuid", "name": "Location A", "timezone": "America/New_York" }] }
```

---

## Templates

### `GET /api/locations/:locationId/templates`
List active templates for a location.

**Query:** `?active=true`
**Roles:** admin, owner
**Response:**
```json
{
  "data": [{
    "id": "uuid",
    "task": "Fire Extinguisher Check",
    "frequency": "monthly",
    "default_assignee_profile_id": "uuid"
  }]
}
```

### `POST /api/locations/:locationId/templates`
Create a new template.

**Roles:** admin, owner
**Body:**
```json
{
  "task": "Fire Extinguisher Check",
  "description": "Verify pressure gauge...",
  "frequency": "monthly",
  "default_assignee_profile_id": "uuid",
  "default_due_rule": { "day_of_month": 1 }
}
```

### `PATCH /api/locations/:locationId/templates/:templateId`
Update a template.

**Roles:** admin, owner

### `DELETE /api/locations/:locationId/templates/:templateId`
Soft-delete (set `active = false`).

**Roles:** admin, owner

---

## Instances

### `GET /api/locations/:locationId/instances`
List inspection instances.

**Query:** `?status=pending&from=2024-01-01&to=2024-12-31&assignee=uuid&page=1&limit=20`
**Roles:** all (filtered by assignment for inspectors)
**Response:**
```json
{
  "data": {
    "items": [{
      "id": "uuid",
      "template_id": "uuid",
      "task": "Fire Extinguisher Check",
      "due_at": "2024-06-01T00:00:00Z",
      "status": "pending",
      "assigned_to_email": "inspector@example.com"
    }],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

### `POST /api/locations/:locationId/instances`
Create a one-off instance (not from template generation).

**Roles:** admin, owner

### `PATCH /api/locations/:locationId/instances/:instanceId`
Update instance (status, remarks, inspected_at, failed_at, passed_at).

**Roles:** admin, owner, nurse, inspector (own assignment only)
**Body:**
```json
{
  "status": "passed",
  "remarks": "All clear. Pressure gauge in green zone.",
  "inspected_at": "2024-06-15T10:30:00Z"
}
```

Appends `inspection_events` row automatically.

### `POST /api/locations/:locationId/instances/:instanceId/sign`
Submit signature for an instance.

**Roles:** any assigned user
**Body:** `multipart/form-data` with `signature` (PNG file), optional `signature_points` (JSON).
**Flow:**
1. Upload PNG to Supabase Storage.
2. Create `inspection_signatures` row.
3. Append `signed` event to `inspection_events`.

### `GET /api/locations/:locationId/instances/:instanceId/events`
Get audit trail for an instance.

**Roles:** admin, owner
**Response:**
```json
{
  "data": [{
    "event_type": "created",
    "event_at": "2024-06-01T00:00:00Z",
    "actor_profile_id": "uuid",
    "payload": {}
  }]
}
```

---

## Invite Codes

### `POST /api/locations/:locationId/invites`
Create an invite code.

**Roles:** admin, owner
**Body:**
```json
{
  "assigned_email": "inspector@example.com",
  "expires_in_days": 7,
  "max_uses": 1
}
```

**Response:**
```json
{
  "data": {
    "code": "ABC12345",
    "expires_at": "2024-06-22T00:00:00Z"
  }
}
```

Note: The plain code is returned ONCE at creation. Only the hash is stored.

---

## Cron

### `GET /api/cron/reminders`
Triggered by Vercel Cron. Secured by `CRON_SECRET` header.

**Logic:**
1. Query pending/overdue instances.
2. Send reminder emails.
3. Log events and outbox entries.
4. Escalate overdue to owner.

---

## Error Shape

All errors follow:
```json
{
  "error": {
    "code": "ROLE_REQUIRED",
    "message": "Role required: admin or owner"
  }
}
```

### Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | No valid session |
| `FORBIDDEN` | 403 | No location access |
| `ROLE_REQUIRED` | 403 | Missing required role |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `INVALID_CODE` | 400 | Invite code invalid |
| `EXPIRED_CODE` | 410 | Invite code expired |
| `CODE_EXHAUSTED` | 409 | Invite code max uses reached |
| `INTERNAL_ERROR` | 500 | Server error |
