/**
 * Application-wide constants
 */

// Cron job batch limits
export const CRON_BATCH_LIMIT = 100
export const NOTIFICATION_BATCH_LIMIT = 50

// Invite code settings
export const INVITE_EXPIRY_DAYS_DEFAULT = 7
export const INVITE_EXPIRY_SECONDS = 60 * 60 * 24 * 7 // 7 days in seconds

// Dashboard limits
export const CALENDAR_EVENTS_LIMIT = 500
export const OVERDUE_ALERTS_LIMIT = 10

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// Password requirements
export const MIN_PASSWORD_LENGTH = 12

// Session durations
export const SESSION_DURATION_DAYS = 7
export const INSPECTOR_SESSION_HOURS = 8
