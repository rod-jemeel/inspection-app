import type { InventoryLogData, InventoryRow } from "@/lib/validations/log-entry"

function blankInventoryRow(): InventoryRow {
  return {
    date: "",
    patient_name: "",
    transaction: "",
    qty_in_stock: null,
    amt_ordered: null,
    amt_used: null,
    amt_wasted: null,
    rn_sig: null,
    rn_name: "",
    witness_sig: null,
    witness_name: "",
  }
}

function parseVialVolume(sizeQty: string): number | null {
  const match = sizeQty.match(/([\d.]+)\s*m[lL]/i)
  return match ? Number.parseFloat(match[1]) : null
}

function normalizeInventoryRow(row: InventoryRow): InventoryRow {
  return {
    date: normalizeInventoryDate(row.date) ?? "",
    patient_name: row.patient_name ?? "",
    transaction: row.transaction ?? "",
    qty_in_stock: row.qty_in_stock ?? null,
    amt_ordered: row.amt_ordered ?? null,
    amt_used: row.amt_used ?? null,
    amt_wasted: row.amt_wasted ?? null,
    rn_sig: row.rn_sig ?? null,
    rn_name: row.rn_name ?? "",
    witness_sig: row.witness_sig ?? null,
    witness_name: row.witness_name ?? "",
  }
}

export function normalizeInventoryDate(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [m, d, y] = value.split("/").map(Number)
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
}

export function parseInventoryDate(value: string | null | undefined): Date | null {
  const normalized = normalizeInventoryDate(value)
  if (!normalized) return null

  const [y, m, d] = normalized.split("-").map(Number)
  const parsed = new Date(y, m - 1, d)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function isMeaningfulInventoryRow(row: InventoryRow): boolean {
  const normalized = normalizeInventoryRow(row)

  return Boolean(
    normalized.date ||
    normalized.patient_name.trim() ||
    normalized.transaction.trim() ||
    normalized.amt_ordered !== null ||
    normalized.amt_used !== null ||
    normalized.amt_wasted !== null ||
    normalized.rn_sig ||
    normalized.rn_name.trim() ||
    normalized.witness_sig ||
    normalized.witness_name.trim()
  )
}

export function sanitizeInventoryRowsForEdit(rows: InventoryRow[]): InventoryRow[] {
  const meaningful: InventoryRow[] = []
  const blanks: InventoryRow[] = []

  for (const row of rows) {
    const normalized = normalizeInventoryRow(row)
    if (isMeaningfulInventoryRow(normalized)) meaningful.push(normalized)
    else blanks.push(blankInventoryRow())
  }

  return [...meaningful, ...blanks]
}

export function computeInventoryRunningStock(data: InventoryLogData): Array<{ before: number; after: number }> {
  const rows = data.rows ?? []
  const vialVolume = parseVialVolume(data.size_qty)
  const running: Array<{ before: number; after: number }> = []

  let prev = data.initial_stock ?? 0

  for (const row of rows) {
    const normalized = normalizeInventoryRow(row)
    const before = prev

    if (!isMeaningfulInventoryRow(normalized)) {
      running.push({ before, after: before })
      continue
    }

    const vialsConsumed =
      vialVolume && normalized.amt_used ? Math.ceil(normalized.amt_used / vialVolume) : 0
    const computed = before + (normalized.amt_ordered ?? 0) - vialsConsumed
    const after = normalized.qty_in_stock ?? computed

    running.push({ before, after })
    prev = after
  }

  return running
}

export function prepareInventoryRowsForSave(data: InventoryLogData): { rows: InventoryRow[]; lockedRowCount: number } {
  const rows = sanitizeInventoryRowsForEdit(data.rows ?? [])
  const runningStock = computeInventoryRunningStock({ ...data, rows })

  const prepared = rows.map((row, index) => {
    if (!isMeaningfulInventoryRow(row)) return blankInventoryRow()

    return {
      ...normalizeInventoryRow(row),
      qty_in_stock: row.qty_in_stock ?? runningStock[index]?.after ?? null,
    }
  })

  return {
    rows: prepared,
    lockedRowCount: prepared.filter(isMeaningfulInventoryRow).length,
  }
}
