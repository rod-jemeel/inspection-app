import { ApiError } from "@/lib/server/errors"
import { normalizeInventoryDate, parseInventoryDate } from "@/lib/logs/inventory"

export function parseMonthKey(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

export function monthKeyToComparable(value: string): number {
  const parsed = parseMonthKey(value)
  if (!parsed) return Number.NaN
  return parsed.year * 100 + parsed.month
}

export function monthInRange(value: string, from: string, to: string): boolean {
  const v = monthKeyToComparable(value)
  const a = monthKeyToComparable(from)
  const b = monthKeyToComparable(to)
  if (Number.isNaN(v) || Number.isNaN(a) || Number.isNaN(b)) return false
  return v >= a && v <= b
}

export function yearKeyInRange(value: string, from: number, to: number): boolean {
  const year = Number(value)
  if (!Number.isInteger(year)) return false
  return year >= from && year <= to
}

export function parseInventoryRowDate(value: string): Date | null {
  const parsed = parseInventoryDate(value)
  if (!parsed) return null
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))
}

export function inventoryRowDateInRange(value: string, from: string, to: string): boolean {
  const iso = normalizeInventoryDate(value)
  if (!iso) return false
  return iso >= from && iso <= to
}

export function assertUnreachable(_value: never, message = "Unhandled case"): never {
  throw new ApiError("INTERNAL_ERROR", message)
}
