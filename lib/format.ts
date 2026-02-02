/**
 * Shared date and time formatting utilities
 */

// Pre-configured formatters (created once, reused)
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

const shortDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const dateOnlyFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
})

const timeOnlyFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: "short",
})

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
})

/**
 * Format a date string to a full date/time string
 * Example: "Jan 15, 2024, 3:30 PM"
 */
export function formatDateTime(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  return dateTimeFormatter.format(date)
}

/**
 * Format a date string to a short date/time string
 * Example: "Jan 15, 3:30 PM"
 */
export function formatShortDateTime(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  return shortDateTimeFormatter.format(date)
}

/**
 * Format a date string to date only
 * Example: "Jan 15, 2024"
 */
export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  return dateOnlyFormatter.format(date)
}

/**
 * Format a date string to time only
 * Example: "3:30 PM"
 */
export function formatTime(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  return timeOnlyFormatter.format(date)
}

/**
 * Format a timestamp for event logs
 * Example: "Jan 15, 3:30 PM"
 */
export function formatEventTime(dateStr: string | Date): string {
  return formatShortDateTime(dateStr)
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  if (Math.abs(diffSec) < 60) {
    return relativeTimeFormatter.format(diffSec, "second")
  } else if (Math.abs(diffMin) < 60) {
    return relativeTimeFormatter.format(diffMin, "minute")
  } else if (Math.abs(diffHour) < 24) {
    return relativeTimeFormatter.format(diffHour, "hour")
  } else {
    return relativeTimeFormatter.format(diffDay, "day")
  }
}

/**
 * Check if a date is overdue (past the current time)
 */
export function isOverdue(dateStr: string | Date): boolean {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  return date < new Date()
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}
