"use client";

import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRASH_CART_ITEMS, MONTH_KEYS } from "@/lib/validations/log-entry";
import type {
  CrashCartLogData,
  CrashCartItem,
  MonthKey,
} from "@/lib/validations/log-entry";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CrashCartTableProps {
  data: CrashCartLogData;
  onChange: (data: CrashCartLogData) => void;
  disabled?: boolean;
  onYearChange?: (year: number) => void;
  isDraft?: boolean;
}

// ---------------------------------------------------------------------------
// Shared cell style constants (matches narcotic-table.tsx pattern)
// ---------------------------------------------------------------------------

const B = "border border-foreground/25";
const HDR = `${B} bg-muted/30 px-2 py-1.5 text-xs font-semibold text-center`;
const CELL = `${B} px-0 py-0`;
const SECTION = `${B} bg-foreground/10 px-2 py-1.5 text-xs font-bold`;
const TXT =
  "h-8 md:h-9 w-full text-center text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring";
const CHECKBOX_WRAP = "flex h-8 md:h-9 items-center justify-center";

// ---------------------------------------------------------------------------
// Month display labels
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseMonthValue(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return undefined;
  }
  return new Date(year, month - 1, 1);
}

function toMonthValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(value: string | undefined): string {
  const date = parseMonthValue(value);
  if (!date) return "Pick";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrashCartTable({
  data,
  onChange,
  disabled,
  onYearChange,
  isDraft,
}: CrashCartTableProps) {
  // -- Update helpers -------------------------------------------------------

  function updatePar(key: string, value: string) {
    onChange({ ...data, par: { ...data.par, [key]: value.replace(/[^\d]/g, "") } });
  }

  function updateExp(key: string, value: string) {
    onChange({ ...data, exp: { ...data.exp, [key]: value } });
  }

  function updateMonth(month: MonthKey, key: string, value: string) {
    onChange({
      ...data,
      months: {
        ...data.months,
        [month]: { ...data.months[month], [key]: value },
      },
    });
  }

  function toggleMonthCheck(month: MonthKey, key: string, checked: boolean) {
    updateMonth(month, key, checked ? "✓" : "");
  }

  function updateCompletedBy(month: MonthKey, value: string) {
    onChange({
      ...data,
      completed_by: { ...data.completed_by, [month]: value },
    });
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="overflow-x-auto touch-action-pan-x">
      <div className="mb-3 rounded border border-foreground/20 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Instructions:</span>{" "}
        Each month identify how many of each item is in stock. Verify each item
        is within the manufacturer&apos;s expiration or open medication is
        within 28 days. Initial on the last row of each month. Complete the name
        section at the bottom.
      </div>
      <table className="w-full border-collapse">
        <thead>
          {/* Year header row */}
          <tr>
            <th
              className={cn(
                HDR,
                "min-w-[100px] xl:min-w-[140px] text-left sticky left-0 z-10 bg-muted",
              )}
            >
              Year:
            </th>
            <th className={cn(HDR, "text-base font-bold")} colSpan={14}>
              {onYearChange ? (
                <Select
                  value={String(data.year)}
                  onValueChange={(v) => onYearChange(Number(v))}
                >
                  <SelectTrigger
                    className="mx-auto h-8 w-[100px] border-0 bg-transparent text-base font-bold shadow-none"
                    aria-label="Select year"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 26 }, (_, i) => 2010 + i).map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="tabular-nums">{data.year}</span>
              )}
            </th>
          </tr>

          {/* Column headers */}
          <tr>
            <th
              className={cn(
                HDR,
                "min-w-[100px] xl:min-w-[140px] text-left sticky left-0 z-10 bg-muted",
              )}
            >
              {" "}
            </th>
            <th className={cn(HDR, "w-[50px] xl:w-[80px]")}>Par</th>
            <th className={cn(HDR, "w-[88px] xl:w-[120px]")}>Exp</th>
            {MONTH_LABELS.map((label, i) => (
              <th
                key={MONTH_KEYS[i]}
                className={cn(HDR, "w-[50px] xl:w-[80px]")}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {CRASH_CART_ITEMS.map((item: CrashCartItem) => {
            // Section header row -- grey banner spanning all columns
            if (item.section) {
              return (
                <tr key={item.key}>
                  <td className={cn(SECTION, "sticky left-0 z-10 bg-muted")}>
                    {item.label}
                  </td>
                  <td className={SECTION} colSpan={14} />
                </tr>
              );
            }

            // Regular / indented item row
            return (
              <tr key={item.key} className="hover:bg-muted/10">
                <td
                  className={cn(
                    CELL,
                    "text-[11px] xl:text-xs leading-tight sticky left-0 z-10 bg-background",
                    item.indent ? "pl-6" : "pl-2",
                  )}
                >
                  {item.label}
                </td>

                {/* Par */}
                <td
                  className={cn(
                    CELL,
                    isDraft && data.par[item.key] && "bg-yellow-50",
                  )}
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={data.par[item.key] || ""}
                    onChange={(e) => updatePar(item.key, e.target.value)}
                    disabled={disabled}
                    aria-label={`Par for ${item.label}`}
                    className={TXT}
                  />
                </td>

                {/* Exp */}
                <td
                  className={cn(
                    CELL,
                    isDraft && data.exp[item.key] && "bg-yellow-50",
                  )}
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={disabled}
                        aria-label={`Exp for ${item.label}`}
                        className={cn(
                          "h-8 md:h-9 w-full justify-between rounded-none border-0 px-1.5 text-[11px] font-normal shadow-none hover:bg-muted/30",
                          !data.exp[item.key] && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">{formatMonthLabel(data.exp[item.key])}</span>
                        <CalendarIcon className="ml-1 size-3 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        selected={parseMonthValue(data.exp[item.key])}
                        defaultMonth={parseMonthValue(data.exp[item.key]) ?? new Date(data.year, 0, 1)}
                        onSelect={(date) => updateExp(item.key, date ? toMonthValue(date) : "")}
                        startMonth={new Date(2020, 0, 1)}
                        endMonth={new Date(2035, 11, 1)}
                      />
                      <div className="border-t p-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-full text-xs"
                          onClick={() => updateExp(item.key, "")}
                          disabled={disabled || !data.exp[item.key]}
                        >
                          Clear month
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>

                {/* 12 month cells */}
                {MONTH_KEYS.map((month) => (
                  <td
                    key={month}
                    className={cn(
                      CELL,
                      isDraft && data.months[month][item.key] && "bg-yellow-50",
                    )}
                  >
                    <div className={CHECKBOX_WRAP}>
                      <input
                        type="checkbox"
                        checked={Boolean(data.months[month][item.key])}
                        onChange={(e) =>
                          toggleMonthCheck(month, item.key, e.target.checked)
                        }
                        disabled={disabled}
                        aria-label={`${item.label} ${month}`}
                        className="size-4 cursor-pointer accent-foreground disabled:cursor-not-allowed"
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Completed by (Initials) row */}
          <tr>
            <td className={cn(SECTION, "sticky left-0 z-10 bg-muted")}>
              Completed by (Initials)
            </td>
            <td className={SECTION} colSpan={2} />
            {MONTH_KEYS.map((month) => (
              <td
                key={month}
                className={cn(
                  CELL,
                  isDraft && data.completed_by[month] && "bg-yellow-50",
                )}
              >
                <input
                  type="text"
                  value={data.completed_by[month] || ""}
                  onChange={(e) => updateCompletedBy(month, e.target.value)}
                  disabled={disabled}
                  aria-label={`Completed by ${month}`}
                  className={cn(TXT, "rounded-none")}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
