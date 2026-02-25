"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Calendar,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { LogPdfExportDialog } from "@/components/log-pdf-export-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SummaryEntry {
  id: string;
  log_date: string;
  status: "draft" | "complete";
  submitted_by_name: string | null;
}

interface CardiacArrestSummaryProps {
  locationId: string;
  /** YYYY-MM */
  currentMonth: string;
}

type SummaryScope = "all" | "month";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns YYYY-MM-DD of last day of given YYYY-MM */
function lastDayOfMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  // day 0 of next month = last day of this month
  const d = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Prev month as YYYY-MM */
function prevMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // month is 0-indexed, go back 1
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Next month as YYYY-MM */
function nextMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m, 1); // month is 0-indexed, go forward 1
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Format YYYY-MM as "January 2026" */
function formatMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Format YYYY-MM-DD as "Mon, Jan 5" */
function formatDate(yyyyMMDD: string): string {
  const [y, m, d] = yyyyMMDD.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Today as YYYY-MM */
function todayMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Today as YYYY-MM-DD */
function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CardiacArrestSummary({
  locationId,
  currentMonth,
}: CardiacArrestSummaryProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [scope, setScope] = useState<SummaryScope>("all");

  // Local state for the date-picker input
  // Initialize to today if current month, else first of displayed month
  const [newDate, setNewDate] = useState<string>(() => {
    const today = todayDate();
    return today.startsWith(currentMonth) ? today : `${currentMonth}-01`;
  });
  const [addError, setAddError] = useState<string | null>(null);

  // Reset newDate whenever currentMonth changes (e.g. year nav crosses a year boundary)
  useEffect(() => {
    const today = todayDate();
    setNewDate(today.startsWith(currentMonth) ? today : `${currentMonth}-01`);
    setAddError(null);
  }, [currentMonth]);

  // Fetch state
  const [entries, setEntries] = useState<SummaryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch entries (all or current month)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setEntries(null);

    const params = new URLSearchParams({
      log_type: "cardiac_arrest_record",
      limit: "100",
      offset: "0",
    });
    if (scope === "month") {
      params.set("from", `${currentMonth}-01`);
      params.set("to", lastDayOfMonth(currentMonth));
    }

    fetch(`/api/locations/${locationId}/logs?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load records");
        return res.json();
      })
      .then((json: { entries: SummaryEntry[] }) => {
        if (!cancelled) setEntries(json.entries ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setFetchError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, currentMonth, scope]);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  function navigateMonth(month: string) {
    startTransition(() => {
      router.push(`/logs/cardiac-arrest?loc=${locationId}&month=${month}`);
    });
  }

  function openEntry(id: string) {
    startTransition(() => {
      router.push(
        `/logs/cardiac-arrest?loc=${locationId}&id=${id}&month=${currentMonth}`,
      );
    });
  }

  function openNewestRecord() {
    if (!entries || entries.length === 0) return;
    openEntry(entries[0].id);
  }

  function openNewRecord() {
    if (!newDate) {
      setAddError("Please select a date");
      return;
    }
    // Validate format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      setAddError("Invalid date format");
      return;
    }
    setAddError(null);
    // Check if a record already exists for this date
    if (entries) {
      const existing = entries.find((e) => e.log_date === newDate);
      if (existing) {
        // Open existing instead of creating duplicate
        openEntry(existing.id);
        return;
      }
    }
    startTransition(() => {
      router.push(
        `/logs/cardiac-arrest?loc=${locationId}&date=${newDate}&month=${currentMonth}`,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Derived: is this month in the future?
  // ---------------------------------------------------------------------------
  const isCurrentOrPast = currentMonth <= todayMonth();
  const newestEntry = entries?.[0] ?? null;
  const availableDateValues = (entries ?? [])
    .map((e) => e.log_date)
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
    .sort();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header + month nav */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">Cardiac Arrest Records</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-md border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={scope === "all" ? "secondary" : "ghost"}
              className="h-7 text-[11px]"
              onClick={() => setScope("all")}
            >
              All Records
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === "month" ? "secondary" : "ghost"}
              className="h-7 text-[11px]"
              onClick={() => setScope("month")}
            >
              This Month
            </Button>
          </div>

          {scope === "month" && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => navigateMonth(prevMonth(currentMonth))}
                title="Previous month"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-xs font-medium min-w-[120px] text-center tabular-nums">
                {formatMonth(currentMonth)}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => navigateMonth(nextMonth(currentMonth))}
                disabled={currentMonth >= todayMonth()}
                title="Next month"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
          <LogPdfExportDialog
            locationId={locationId}
            logType="cardiac_arrest_record"
            rangeKind="date"
            defaultRange={{
              dateFrom: scope === "month" ? `${currentMonth}-01` : `${todayMonth()}-01`,
              dateTo: scope === "month" ? lastDayOfMonth(currentMonth) : todayDate(),
            }}
            availableDateValues={availableDateValues}
          />
        </div>
      </div>

      {!loading && !fetchError && newestEntry && (
        <div className="border border-border/50 rounded-sm p-3 flex flex-wrap items-center justify-between gap-2 bg-muted/10">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Newest Record
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{formatDate(newestEntry.log_date)}</p>
              <Badge
                variant={newestEntry.status === "complete" ? "default" : "secondary"}
                className="text-[10px]"
              >
                {newestEntry.status}
              </Badge>
              {newestEntry.submitted_by_name && (
                <span className="text-xs text-muted-foreground truncate">
                  {newestEntry.submitted_by_name}
                </span>
              )}
            </div>
          </div>
          <Button size="sm" className="h-8" onClick={openNewestRecord}>
            <Clock3 className="size-3.5 mr-1" />
            Open Newest
          </Button>
        </div>
      )}

      {/* Record list */}
      <div className="border border-border/50 rounded-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {!loading && fetchError && (
          <div className="flex items-center justify-center py-10 text-xs text-destructive px-4 text-center">
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && entries && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Calendar className="size-8 opacity-30" />
            <p className="text-xs">
              {scope === "month"
                ? `No records for ${formatMonth(currentMonth)}`
                : "No cardiac arrest records yet"}
            </p>
          </div>
        )}

        {!loading && !fetchError && entries && entries.length > 0 && (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">
                  Submitted By
                </th>
                <th className="px-3 py-2 text-center font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2.5 font-medium">
                    {formatDate(entry.log_date)}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[140px]">
                    {entry.submitted_by_name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge
                      variant={
                        entry.status === "complete" ? "default" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => openEntry(entry.id)}
                    >
                      <FileText className="size-3 mr-1" />
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add new record */}
      {isCurrentOrPast && (
        <div className="border border-border/50 rounded-sm p-3 space-y-2">
          <p className="text-xs font-semibold">Add New Record</p>
          {scope === "all" && (
            <p className="text-[11px] text-muted-foreground">
              Choose a date to create a new record. Existing dates will open the saved record.
            </p>
          )}
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <Input
                type="date"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  setAddError(null);
                }}
                max={todayDate()}
                className="h-8 text-xs w-full"
                aria-label="Arrest date"
              />
              {addError && (
                <p className="text-[11px] text-destructive">{addError}</p>
              )}
              {entries && entries.find((e) => e.log_date === newDate) && (
                <p className="text-[11px] text-amber-600">
                  A record already exists for this date - clicking Add will open
                  it.
                </p>
              )}
            </div>
            <Button size="sm" className="h-8 shrink-0" onClick={openNewRecord}>
              <Plus className="size-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
