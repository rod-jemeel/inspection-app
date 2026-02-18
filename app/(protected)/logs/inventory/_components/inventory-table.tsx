"use client";

import { useMemo } from "react";
import { Plus, Trash2, CalendarIcon, Lock } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SignatureCell } from "../../narcotic/_components/signature-cell";
import { cn } from "@/lib/utils";
import type {
  InventoryLogData,
  InventoryRow,
} from "@/lib/validations/log-entry";

// Helper: Date object → YYYY-MM-DD string (local timezone)
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface InventoryTableProps {
  data: InventoryLogData;
  onChange: (data: InventoryLogData) => void;
  locationId: string;
  disabled?: boolean;
  /** Rows with index < lockedRowCount are read-only (already saved) */
  lockedRowCount?: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  isDraft?: boolean;
}

function emptyRow(): InventoryRow {
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
  };
}

function isRowEmpty(row: InventoryRow): boolean {
  return (
    !row.date.trim() &&
    !row.patient_name.trim() &&
    !row.transaction.trim() &&
    row.qty_in_stock === null &&
    row.amt_ordered === null &&
    row.amt_used === null &&
    row.amt_wasted === null &&
    !row.rn_sig &&
    !row.rn_name &&
    !row.witness_sig &&
    !row.witness_name
  );
}

// ---------------------------------------------------------------------------
// Shared cell style constants (matches narcotic-table.tsx exactly)
// ---------------------------------------------------------------------------

const B = "border border-foreground/25";
const HDR = `${B} bg-muted/30 px-2 py-2 text-xs font-semibold text-center`;
const CELL = `${B} px-1.5 py-1.5`;
const GREY = "bg-muted/15";
const NUM =
  "h-8 md:h-9 w-full text-center text-xs tabular-nums border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const TXT =
  "h-8 md:h-9 w-full text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring";

// Parse vial volume from size_qty string (e.g., "2mL vials" → 2)
function parseVialVolume(sizeQty: string): number | null {
  const match = sizeQty.match(/([\d.]+)\s*m[lL]/i);
  return match ? parseFloat(match[1]) : null;
}

// Calculate waste: if 5mL used and vials are 2mL each, need 3 vials (6mL), waste = 1mL
function computeWaste(amtUsed: number, vialVol: number): number {
  if (amtUsed <= 0 || vialVol <= 0) return 0;
  const vialsNeeded = Math.ceil(amtUsed / vialVol);
  return +(vialsNeeded * vialVol - amtUsed).toFixed(2);
}

export function InventoryTable({
  data,
  onChange,
  locationId,
  disabled,
  lockedRowCount = 0,
  dateRange,
  onDateRangeChange,
  isDraft,
}: InventoryTableProps) {
  const vialVolume = useMemo(
    () => parseVialVolume(data.size_qty),
    [data.size_qty],
  );

  function updateHeader<K extends keyof InventoryLogData>(
    field: K,
    value: InventoryLogData[K],
  ) {
    onChange({ ...data, [field]: value });
  }

  function updateRow(index: number, updates: Partial<InventoryRow>) {
    const rows = [...data.rows];
    rows[index] = { ...rows[index], ...updates };
    onChange({ ...data, rows });
  }

  // When amt_used changes, auto-fill waste if vial volume is known
  function handleAmtUsedChange(index: number, raw: string) {
    const amtUsed = raw === "" ? null : Number(raw);
    const updates: Partial<InventoryRow> = { amt_used: amtUsed };
    // Auto-calculate waste only if user hasn't manually set it
    if (vialVolume && amtUsed !== null && amtUsed > 0) {
      const autoWaste = computeWaste(amtUsed, vialVolume);
      // Only auto-fill if current waste is null (not manually overridden)
      if (data.rows[index].amt_wasted === null) {
        updates.amt_wasted = autoWaste > 0 ? autoWaste : null;
      }
    }
    updateRow(index, updates);
  }

  function addRow() {
    if (data.rows.length >= 200) return;
    onChange({ ...data, rows: [...data.rows, emptyRow()] });
  }

  function removeRow(index: number) {
    if (data.rows.length <= 1) return;
    if (index < lockedRowCount) return; // can't delete saved rows
    const rows = data.rows.filter((_, i) => i !== index);
    onChange({ ...data, rows });
  }

  // Compute running stock balance for each row: { before, after }
  // Stock is counted in UNITS (vials). Amt Used/Wasted are in mL.
  // Vials consumed = ceil(amt_used_mL / vial_volume_mL)
  // after = before + amt_ordered_units - vials_consumed
  const runningStock = useMemo(() => {
    const result: { before: number; after: number }[] = [];
    let prev = data.initial_stock ?? 0;
    for (const row of data.rows) {
      const before = prev;
      const vialsConsumed =
        vialVolume && row.amt_used ? Math.ceil(row.amt_used / vialVolume) : 0;
      const after = before + (row.amt_ordered ?? 0) - vialsConsumed;
      // If user manually set qty_in_stock, use that as the "after"
      const finalAfter = row.qty_in_stock ?? after;
      result.push({ before, after: finalAfter });
      prev = finalAfter;
    }
    return result;
  }, [data.rows, data.initial_stock, vialVolume]);

  // Derive string boundaries from dateRange for filtering
  const dateFrom = dateRange?.from ? toDateStr(dateRange.from) : "";
  const dateTo = dateRange?.to ? toDateStr(dateRange.to) : "";

  // Filter which rows to display based on date range
  const filteredIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      const rowDate = data.rows[i].date;
      if (!rowDate) {
        // Always show rows without dates (they're being filled)
        indices.push(i);
        continue;
      }
      if (dateFrom && rowDate < dateFrom) continue;
      if (dateTo && rowDate > dateTo) continue;
      indices.push(i);
    }
    return indices;
  }, [data.rows, dateFrom, dateTo]);

  return (
    <div className="space-y-3">
      {/* Combined ledger table (header + rows) */}
      <div className="max-w-full overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Drug info header */}
          <thead>
            <tr>
              <th className={cn(HDR, "w-[100px] xl:w-[140px]")} colSpan={1}>
                Drug Name
              </th>
              <td className={cn(CELL, "min-w-[140px] xl:min-w-[200px]")} colSpan={3}>
                <Input
                  className={TXT}
                  value={data.drug_name}
                  onChange={(e) => updateHeader("drug_name", e.target.value)}
                  placeholder="Drug name"
                  disabled={disabled}
                />
              </td>
              <th className={cn(HDR, "w-[70px] xl:w-[100px]")}>Strength</th>
              <td className={cn(CELL, "min-w-[80px] xl:min-w-[120px]")} colSpan={2}>
                <Input
                  className={TXT}
                  value={data.strength}
                  onChange={(e) => updateHeader("strength", e.target.value)}
                  placeholder="e.g., 5mg/mL"
                  disabled={disabled}
                />
              </td>
              <th className={cn(HDR, "w-[70px] xl:w-[100px]")}>Size / Qty</th>
              <td className={cn(CELL, "min-w-[80px] xl:min-w-[120px]")}>
                <Input
                  className={TXT}
                  value={data.size_qty}
                  onChange={(e) => updateHeader("size_qty", e.target.value)}
                  placeholder="e.g., 2mL vials"
                  disabled={disabled}
                />
              </td>
            </tr>
            {/* Column headers */}
            <tr>
              <th className={cn(HDR, "w-[100px] xl:w-[150px]")}>Date</th>
              <th className={cn(HDR, "min-w-[120px] xl:min-w-[200px]")}>MD/CRNA or Patient</th>
              <th className={cn(HDR, "w-[160px] xl:w-[300px]")}>Transaction</th>
              <th className={cn(HDR, "w-[80px] xl:w-[110px]", GREY)}>Qty in Stock</th>
              <th className={cn(HDR, "w-[70px] xl:w-[100px]")}>Amt Ordered</th>
              <th className={cn(HDR, "w-[70px] xl:w-[100px]")}>Amt Used</th>
              <th className={cn(HDR, "w-[70px] xl:w-[100px]")}>Amt Wasted</th>
              <th className={cn(HDR, "w-[140px] xl:w-[200px]")}>RN Signature</th>
              <th className={cn(HDR, "w-[140px] xl:w-[200px]")}>Witness</th>
              {!disabled && <th className={cn(B, "w-[36px] bg-muted/30")} />}
            </tr>
          </thead>
          <tbody>
            {filteredIndices.map((i) => {
              const row = data.rows[i];
              const isLocked = disabled || i < lockedRowCount;
              return (
                <tr key={i} className={cn(i % 2 === 1 ? "bg-muted/5" : "", isLocked && !disabled && "bg-muted/10")}>
                {/* Date */}
                <td className={cn(CELL, isDraft && row.date && "bg-yellow-50")}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={isLocked}
                        className={cn(
                          "flex h-8 md:h-9 w-full items-center justify-center gap-1 text-xs",
                          !row.date && "text-muted-foreground",
                        )}
                      >
                        {row.date ? (
                          row.date
                        ) : (
                          <CalendarIcon className="size-3.5 text-muted-foreground/40" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          row.date
                            ? new Date(row.date + "T00:00:00")
                            : undefined
                        }
                        onSelect={(d) => {
                          if (d) {
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, "0");
                            const day = String(d.getDate()).padStart(2, "0");
                            updateRow(i, { date: `${y}-${m}-${day}` });
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </td>

                {/* Patient / MD name */}
                <td className={cn(CELL, isDraft && row.patient_name && "bg-yellow-50")}>
                  <Input
                    className={TXT}
                    value={row.patient_name}
                    onChange={(e) =>
                      updateRow(i, { patient_name: e.target.value })
                    }
                    placeholder=""
                    disabled={isLocked}
                  />
                </td>

                {/* Transaction */}
                <td className={cn(CELL, isDraft && row.transaction && "bg-yellow-50")}>
                  <Input
                    className={TXT}
                    value={row.transaction}
                    onChange={(e) =>
                      updateRow(i, { transaction: e.target.value })
                    }
                    placeholder=""
                    disabled={isLocked}
                  />
                </td>

                {/* Qty in Stock — diagonal split: before (top-left) / after (bottom-right) */}
                <td className={cn(CELL, GREY, "relative p-0", isDraft && row.qty_in_stock !== null && "bg-yellow-50")}>
                  <div className="relative flex h-12 w-full flex-col items-center justify-between overflow-hidden">
                    {/* Diagonal line: top-right to bottom-left */}
                    <div className="pointer-events-none absolute inset-0 z-0">
                      <svg className="h-full w-full" preserveAspectRatio="none">
                        <line
                          x1="100%"
                          y1="0"
                          x2="0"
                          y2="100%"
                          stroke="currentColor"
                          className="text-foreground/20"
                          strokeWidth="1"
                        />
                      </svg>
                    </div>
                    {/* Before (top-left) — first row: editable initial stock; rest: derived */}
                    {i === 0 ? (
                      <input
                        type="number"
                        className="relative z-10 w-[50px] self-start bg-transparent pl-1 pt-0.5 text-[11px] tabular-nums text-muted-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={data.initial_stock ?? ""}
                        placeholder="Qty"
                        onChange={(e) =>
                          updateHeader("initial_stock", e.target.value === "" ? null : Number(e.target.value))
                        }
                        disabled={isLocked}
                      />
                    ) : (
                      <span className="relative z-10 self-start pl-1 pt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {runningStock[i].before}
                      </span>
                    )}
                    {/* After (bottom-right) — editable, computed shown as placeholder */}
                    <input
                      type="number"
                      className="relative z-10 w-[50px] self-end bg-transparent pb-0.5 pr-1 text-right text-[11px] tabular-nums font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={row.qty_in_stock ?? ""}
                      placeholder={String(runningStock[i].after)}
                      onChange={(e) =>
                        updateRow(i, {
                          qty_in_stock:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                      disabled={isLocked}
                    />
                  </div>
                </td>

                {/* Amt Ordered */}
                <td className={cn(CELL, isDraft && row.amt_ordered !== null && "bg-yellow-50")}>
                  <Input
                    type="number"
                    className={NUM}
                    value={row.amt_ordered ?? ""}
                    onChange={(e) =>
                      updateRow(i, {
                        amt_ordered:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="—"
                    disabled={isLocked}
                  />
                </td>

                {/* Amt Used */}
                <td className={cn(CELL, isDraft && row.amt_used !== null && "bg-yellow-50")}>
                  <Input
                    type="number"
                    className={NUM}
                    value={row.amt_used ?? ""}
                    onChange={(e) => handleAmtUsedChange(i, e.target.value)}
                    placeholder="—"
                    disabled={isLocked}
                  />
                </td>

                {/* Amt Wasted (auto-calculated from vial size) */}
                <td className={cn(CELL, isDraft && row.amt_wasted !== null && "bg-yellow-50")}>
                  <Input
                    type="number"
                    className={NUM}
                    value={row.amt_wasted ?? ""}
                    onChange={(e) =>
                      updateRow(i, {
                        amt_wasted:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder={
                      vialVolume && row.amt_used !== null && row.amt_used > 0
                        ? String(computeWaste(row.amt_used, vialVolume))
                        : "—"
                    }
                    disabled={isLocked}
                  />
                </td>

                {/* RN Signature */}
                <td className={cn(CELL, isDraft && row.rn_sig && "bg-yellow-50")}>
                  <SignatureCell
                    value={row.rn_sig}
                    onChange={(_, base64) => updateRow(i, { rn_sig: base64 })}
                    signerName={row.rn_name}
                    onNameChange={(name) => updateRow(i, { rn_name: name })}
                    locationId={locationId}
                    disabled={isLocked}
                    className="h-10"
                  />
                </td>

                {/* Witness Signature */}
                <td className={cn(CELL, isDraft && row.witness_sig && "bg-yellow-50")}>
                  <SignatureCell
                    value={row.witness_sig}
                    onChange={(_, base64) =>
                      updateRow(i, { witness_sig: base64 })
                    }
                    signerName={row.witness_name}
                    onNameChange={(name) =>
                      updateRow(i, { witness_name: name })
                    }
                    locationId={locationId}
                    disabled={isLocked}
                    className="h-10"
                  />
                </td>

                {/* Delete row button — only on unlocked rows */}
                {!disabled && (
                  <td className={cn(B, "px-1 py-1 text-center")}>
                    {i < lockedRowCount ? (
                      <span className="inline-flex size-6 items-center justify-center">
                        <Lock className="size-3 text-muted-foreground/40" />
                      </span>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => removeRow(i)}
                        disabled={data.rows.length <= 1}
                      >
                        <Trash2 className="size-3 text-muted-foreground" />
                      </Button>
                    )}
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      {!disabled && (
        <Button
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={data.rows.length >= 200}
          className="text-xs"
        >
          <Plus className="mr-1 size-3" />
          Add Row
        </Button>
      )}
    </div>
  );
}
