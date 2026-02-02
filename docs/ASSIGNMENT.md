# Assignment Feature

This document describes the inspector assignment system for inspection tasks.

## Overview

Inspections can be assigned to inspectors by email. This allows:
- Pre-assigning inspectors before they register
- Reassigning tasks to different inspectors
- Integration with the invite system for external inspectors

## How It Works

### Template Default Assignee

Templates can have a **default assignee email** that automatically applies to new inspection instances.

1. When creating/editing a template, enter an email in the "Default Assignee Email" field
2. New instances generated from this template will inherit this assignment
3. If the email matches a registered user, the system auto-links to their profile

### Reassigning Inspections

Active inspections (pending, in_progress, or failed) can be reassigned:

1. Open the inspection detail modal
2. Click the edit icon next to "Assigned To"
3. Enter the new inspector's email
4. Click "Reassign"

The system will:
- Update `assigned_to_email` on the instance
- Auto-link to `assigned_to_profile_id` if the email matches a registered user
- Clear the profile link if the email doesn't match (external inspector)

## Database Schema

### inspection_templates

| Column | Type | Description |
|--------|------|-------------|
| `default_assignee_profile_id` | UUID | FK to profiles (auto-linked) |
| `default_assignee_email` | TEXT | Email of default inspector |

### inspection_instances

| Column | Type | Description |
|--------|------|-------------|
| `assigned_to_profile_id` | UUID | FK to profiles (auto-linked) |
| `assigned_to_email` | TEXT | Email of assigned inspector |

## API

### Update Template

```
PUT /api/locations/:locationId/templates/:templateId
```

Body:
```json
{
  "default_assignee_email": "inspector@example.com"
}
```

### Update Instance (Reassign)

```
PUT /api/locations/:locationId/instances/:instanceId
```

Body:
```json
{
  "assigned_to_email": "new-inspector@example.com"
}
```

## Profile Linking

When an email is provided, the system automatically:

1. Searches for a profile with matching email
2. If found: sets `assigned_to_profile_id` to the profile ID
3. If not found: sets `assigned_to_profile_id` to null (external inspector)

This means:
- Registered users get full profile linking
- External inspectors can be assigned by email before they register
- When an inspector registers via invite, existing assignments remain (future enhancement: auto-link on registration)

## UI Components

### Template Card

Shows badges for:
- Frequency (colored: blue=weekly, purple=monthly, amber=yearly, emerald=every_3_years)
- Due date (with calendar icon)
- Assignee email (with user icon)

### Template Dialog

Fields:
- Task Name (required)
- Description
- Frequency
- Due Day/Month (based on frequency)
- **Default Assignee Email** (optional)
- Active toggle (edit only)

### Inspection Modal

Displays:
- "Assigned To" field with email or "Unassigned"
- Edit button (for non-terminal inspections) opens reassign popover
- Reassign popover with email input and confirm/cancel buttons

## Invite Integration

The assignment system works with the invite feature:

1. Admin assigns `inspector@example.com` to a template/instance
2. Admin creates an invite code for that email
3. Inspector receives invite, registers with that email
4. System links their profile to existing assignments (future enhancement)

Currently, the profile link happens on new assignments. Auto-linking existing assignments on registration can be added as a future enhancement.
