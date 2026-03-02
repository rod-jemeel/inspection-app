"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMySignature } from "@/hooks/use-my-signature";
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
import {
  computeInventoryRunningStock,
  normalizeInventoryDate,
  parseInventoryDate,
} from "@/lib/logs/inventory";
import { cn } from "@/lib/utils";
import type {
  InventoryLogData,
  InventoryRow,
} from "@/lib/validations/log-entry";

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
  lockedRowCount?: number;
  dateRange?: DateRange;
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

const B = "border border-foreground/25";
const HDR = `${B} bg-muted/30 px-2 py-2 text-xs font-semibold text-center`;
const CELL = `${B} px-1.5 py-1.5`;
const GREY = "bg-muted/15";
const NUM =
  "h-8 md:h-9 w-full text-center text-xs tabular-nums border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const TXT =
  "h-8 md:h-9 w-full text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring";

function parseVialVolume(sizeQty: string): number | null {
  const match = sizeQty.match(/([\d.]+)\s*m[lL]/i);
  return match ? parseFloat(match[1]) : null;
}

function computeWaste(amtUsed: number, vialVol: number): number {
  if (amtUsed <= 0 || vialVol <= 0) return 0;
  const vialsNeeded = Math.ceil(amtUsed / vialVol);
  return +(vialsNeeded * vialVol - amtUsed).toFixed(2);
}

function InventoryTableHeader({
  data,
  disabled,
  onUpdateHeader,
  showDeleteColumn,
}: {
  data: InventoryLogData;
  disabled?: boolean;
  onUpdateHeader: <K extends keyof InventoryLogData>(
    field: K,
    value: InventoryLogData[K],
  ) => void;
  showDeleteColumn: boolean;
}) {
  return (
    <thead>
      <tr>
        <th className={cn(HDR, "w-[100px] xl:w-[140px]")}>Drug Name</th>
        <td className={cn(CELL, "min-w-[140px] xl:min-w-[200px]")} colSpan={3}>
          <Input
            className={TXT}
            value={data.drug_name}
            onChange={(e) => onUpdateHeader("drug_name", e.target.value)}
            placeholder="Drug name"
            disabled={disabled}
          />
        </td>
        <th className={cn(HDR, "w-[70px] xl:w-[100px]")}>Strength</th>
        <td className={cn(CELL, "min-w-[80px] xl:min-w-[120px]")} colSpan={2}>
          <Input
            className={TXT}
            value={data.strength}
            onChange={(e) => onUpdateHeader("strength", e.target.value)}
            placeholder="e.g., 5mg/mL"
            disabled={disabled}
          />
        </td>
        <th className={cn(HDR, "w-[70px] xl:w-[100px]")}>Size / Qty</th>
        <td className={cn(CELL, "min-w-[80px] xl:min-w-[120px]")}>
          <Input
            className={TXT}
            value={data.size_qty}
            onChange={(e) => onUpdateHeader("size_qty", e.target.value)}
            placeholder="e.g., 2mL vials"
            disabled={disabled}
          />
        </td>
      </tr>
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
        {showDeleteColumn && <th className={cn(B, "w-[36px] bg-muted/30")} />}
      </tr>
    </thead>
  );
}

function InventoryDateCell({
  row,
  rowIndex,
  isLocked,
  isDraft,
  onUpdateRow,
}: {
  row: InventoryRow;
  rowIndex: number;
  isLocked: boolean;
  isDraft?: boolean;
  onUpdateRow: (index: number, updates: Partial<InventoryRow>) => void;
}) {
  return (
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
            {row.date ? row.date : <CalendarIcon className="size-3.5 text-muted-foreground/40" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            startMonth={new Date(2020, 0, 1)}
            endMonth={new Date(2035, 11, 1)}
            selected={row.date ? parseInventoryDate(row.date) ?? undefined : undefined}
            onSelect={(d) => {
              if (d) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                onUpdateRow(rowIndex, { date: `${y}-${m}-${day}` });
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </td>
  );
}

function InventoryStockCell({
  row,
  rowIndex,
  isLocked,
  isDraft,
  initialStock,
  runningStock,
  onUpdateHeader,
  onUpdateRow,
}: {
  row: InventoryRow;
  rowIndex: number;
  isLocked: boolean;
  isDraft?: boolean;
  initialStock: number | null;
  runningStock: { before: number; after: number };
  onUpdateHeader: <K extends keyof InventoryLogData>(
    field: K,
    value: InventoryLogData[K],
  ) => void;
  onUpdateRow: (index: number, updates: Partial<InventoryRow>) => void;
}) {
  return (
    <td className={cn(CELL, GREY, "relative p-0", isDraft && row.qty_in_stock !== null && "bg-yellow-50")}>
      <div className="relative flex h-12 w-full flex-col items-center justify-between overflow-hidden">
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
        {rowIndex === 0 ? (
          <input
            type="number"
            className="relative z-10 w-[50px] self-start bg-transparent pl-1 pt-0.5 text-[11px] tabular-nums text-muted-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={initialStock ?? ""}
            placeholder="Qty"
            onChange={(e) =>
              onUpdateHeader("initial_stock", e.target.value === "" ? null : Number(e.target.value))
            }
            disabled={isLocked}
          />
        ) : (
          <span className="relative z-10 self-start pl-1 pt-0.5 text-[10px] tabular-nums text-muted-foreground">
            {runningStock.before}
          </span>
        )}
        <input
          type="number"
          className="relative z-10 w-[50px] self-end bg-transparent pb-0.5 pr-1 text-right text-[11px] tabular-nums font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={row.qty_in_stock ?? ""}
          placeholder={String(runningStock.after)}
          onChange={(e) =>
            onUpdateRow(rowIndex, {
              qty_in_stock: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          disabled={isLocked}
        />
      </div>
    </td>
  );
}

function InventorySignaturePair({
  row,
  rowIndex,
  locationId,
  isLocked,
  isDraft,
  defaultSignerName,
  onUpdateRow,
}: {
  row: InventoryRow;
  rowIndex: number;
  locationId: string;
  isLocked: boolean;
  isDraft?: boolean;
  defaultSignerName?: string;
  onUpdateRow: (index: number, updates: Partial<InventoryRow>) => void;
}) {
  return (
    <>
      <td className={cn(CELL, isDraft && row.rn_sig && "bg-yellow-50")}>
        <SignatureCell
          value={row.rn_sig}
          onChange={() => {}}
          signerName={row.rn_name}
          locationId={locationId}
          disabled={isLocked}
          className="h-10"
          defaultSignerName={defaultSignerName}
          onSignedMetaChange={(meta) =>
            onUpdateRow(rowIndex, {
              rn_sig: meta?.signatureBase64 ?? null,
              rn_name: meta?.signerName ?? "",
            })
          }
        />
      </td>
      <td className={cn(CELL, isDraft && row.witness_sig && "bg-yellow-50")}>
        <SignatureCell
          value={row.witness_sig}
          onChange={() => {}}
          signerName={row.witness_name}
          locationId={locationId}
          disabled={isLocked}
          className="h-10"
          defaultSignerName={defaultSignerName}
          onSignedMetaChange={(meta) =>
            onUpdateRow(rowIndex, {
              witness_sig: meta?.signatureBase64 ?? null,
              witness_name: meta?.signerName ?? "",
            })
          }
        />
      </td>
    </>
  );
}

function InventoryTableRow({
  row,
  rowIndex,
  locationId,
  isLocked,
  isDraft,
  vialVolume,
  runningStock,
  initialStock,
  defaultSignerName,
  showDeleteColumn,
  canDelete,
  onUpdateHeader,
  onUpdateRow,
  onAmtUsedChange,
  onRemoveRow,
}: {
  row: InventoryRow;
  rowIndex: number;
  locationId: string;
  isLocked: boolean;
  isDraft?: boolean;
  vialVolume: number | null;
  runningStock: { before: number; after: number };
  initialStock: number | null;
  defaultSignerName?: string;
  showDeleteColumn: boolean;
  canDelete: boolean;
  onUpdateHeader: <K extends keyof InventoryLogData>(
    field: K,
    value: InventoryLogData[K],
  ) => void;
  onUpdateRow: (index: number, updates: Partial<InventoryRow>) => void;
  onAmtUsedChange: (index: number, raw: string) => void;
  onRemoveRow: (index: number) => void;
}) {
  return (
    <tr className={cn(rowIndex % 2 === 1 ? "bg-muted/5" : "", isLocked && "bg-muted/10")}>
      <InventoryDateCell
        row={row}
        rowIndex={rowIndex}
        isLocked={isLocked}
        isDraft={isDraft}
        onUpdateRow={onUpdateRow}
      />
      <td className={cn(CELL, isDraft && row.patient_name && "bg-yellow-50")}>
        <Input
          className={TXT}
          value={row.patient_name}
          onChange={(e) => onUpdateRow(rowIndex, { patient_name: e.target.value })}
          placeholder=""
          disabled={isLocked}
        />
      </td>
      <td className={cn(CELL, isDraft && row.transaction && "bg-yellow-50")}>
        <Input
          className={TXT}
          value={row.transaction}
          onChange={(e) => onUpdateRow(rowIndex, { transaction: e.target.value })}
          placeholder=""
          disabled={isLocked}
        />
      </td>
      <InventoryStockCell
        row={row}
        rowIndex={rowIndex}
        isLocked={isLocked}
        isDraft={isDraft}
        initialStock={initialStock}
        runningStock={runningStock}
        onUpdateHeader={onUpdateHeader}
        onUpdateRow={onUpdateRow}
      />
      <td className={cn(CELL, isDraft && row.amt_ordered !== null && "bg-yellow-50")}>
        <Input
          type="number"
          className={NUM}
          value={row.amt_ordered ?? ""}
          onChange={(e) =>
            onUpdateRow(rowIndex, {
              amt_ordered: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder="-"
          disabled={isLocked}
        />
      </td>
      <td className={cn(CELL, isDraft && row.amt_used !== null && "bg-yellow-50")}>
        <Input
          type="number"
          className={NUM}
          value={row.amt_used ?? ""}
          onChange={(e) => onAmtUsedChange(rowIndex, e.target.value)}
          placeholder="-"
          disabled={isLocked}
        />
      </td>
      <td className={cn(CELL, isDraft && row.amt_wasted !== null && "bg-yellow-50")}>
        <Input
          type="number"
          className={NUM}
          value={row.amt_wasted ?? ""}
          onChange={(e) =>
            onUpdateRow(rowIndex, {
              amt_wasted: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder={
            vialVolume && row.amt_used !== null && row.amt_used > 0
              ? String(computeWaste(row.amt_used, vialVolume))
              : "-"
          }
          disabled={isLocked}
        />
      </td>
      <InventorySignaturePair
        row={row}
        rowIndex={rowIndex}
        locationId={locationId}
        isLocked={isLocked}
        isDraft={isDraft}
        defaultSignerName={defaultSignerName}
        onUpdateRow={onUpdateRow}
      />
      {showDeleteColumn && (
        <td className={cn(B, "px-1 py-1 text-center")}>
          {!canDelete ? (
            <span className="inline-flex size-6 items-center justify-center">
              <Lock className="size-3 text-muted-foreground/40" />
            </span>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={() => onRemoveRow(rowIndex)}
            >
              <Trash2 className="size-3 text-muted-foreground" />
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}

export function InventoryTable({
  data,
  onChange,
  locationId,
  disabled,
  lockedRowCount = 0,
  dateRange,
  isDraft,
}: InventoryTableProps) {
  const { profile: myProfile } = useMySignature();
  const nextRowRenderKeyRef = useRef(data.rows.length);
  const [rowRenderKeys, setRowRenderKeys] = useState<string[]>(
    () => data.rows.map((_, index) => `inventory-row-${index}`),
  );

  useEffect(() => {
    setRowRenderKeys((current) => {
      if (current.length === data.rows.length) return current;
      if (current.length > data.rows.length) return current.slice(0, data.rows.length);

      const next = [...current];
      while (next.length < data.rows.length) {
        next.push(`inventory-row-${nextRowRenderKeyRef.current++}`);
      }
      return next;
    });
  }, [data.rows.length]);

  const vialVolume = useMemo(() => parseVialVolume(data.size_qty), [data.size_qty]);

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

  function handleAmtUsedChange(index: number, raw: string) {
    const amtUsed = raw === "" ? null : Number(raw);
    const updates: Partial<InventoryRow> = { amt_used: amtUsed };
    if (vialVolume && amtUsed !== null && amtUsed > 0 && data.rows[index].amt_wasted === null) {
      const autoWaste = computeWaste(amtUsed, vialVolume);
      updates.amt_wasted = autoWaste > 0 ? autoWaste : null;
    }
    updateRow(index, updates);
  }

  function addRow() {
    if (data.rows.length >= 200) return;
    setRowRenderKeys((current) => [...current, `inventory-row-${nextRowRenderKeyRef.current++}`]);
    onChange({ ...data, rows: [...data.rows, emptyRow()] });
  }

  function removeRow(index: number) {
    if (data.rows.length <= 1 || index < lockedRowCount) return;
    setRowRenderKeys((current) => current.filter((_, i) => i !== index));
    onChange({ ...data, rows: data.rows.filter((_, i) => i !== index) });
  }

  const runningStock = useMemo(() => computeInventoryRunningStock(data), [data]);
  const dateFrom = dateRange?.from ? toDateStr(dateRange.from) : "";
  const dateTo = dateRange?.to ? toDateStr(dateRange.to) : "";

  const filteredIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      const rowDate = data.rows[i].date;
      if (!rowDate) {
        indices.push(i);
        continue;
      }
      const rowDateIso = normalizeInventoryDate(rowDate);
      if (!rowDateIso) {
        indices.push(i);
        continue;
      }
      if (dateFrom && rowDateIso < dateFrom) continue;
      if (dateTo && rowDateIso > dateTo) continue;
      indices.push(i);
    }
    return indices;
  }, [data.rows, dateFrom, dateTo]);

  return (
    <div className="space-y-3">
      <div className="max-w-full overflow-x-auto">
        <table className="w-full border-collapse">
          <InventoryTableHeader
            data={data}
            disabled={disabled}
            onUpdateHeader={updateHeader}
            showDeleteColumn={!disabled}
          />
          <tbody>
            {filteredIndices.map((index) => {
              const row = data.rows[index];
              const isLocked = !!disabled || index < lockedRowCount;

              return (
                <InventoryTableRow
                  key={rowRenderKeys[index] ?? `inventory-row-fallback-${index}`}
                  row={row}
                  rowIndex={index}
                  locationId={locationId}
                  isLocked={isLocked}
                  isDraft={isDraft}
                  vialVolume={vialVolume}
                  runningStock={runningStock[index]}
                  initialStock={data.initial_stock}
                  defaultSignerName={myProfile?.name}
                  showDeleteColumn={!disabled}
                  canDelete={index >= lockedRowCount && data.rows.length > 1}
                  onUpdateHeader={updateHeader}
                  onUpdateRow={updateRow}
                  onAmtUsedChange={handleAmtUsedChange}
                  onRemoveRow={removeRow}
                />
              );
            })}
          </tbody>
        </table>
      </div>

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
