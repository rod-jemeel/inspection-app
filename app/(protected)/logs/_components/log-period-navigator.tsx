"use client"

import { useMemo } from "react"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type DateNavigatorProps = {
  kind: "date"
  value: string
  onNavigate: (offset: number) => void
  onChange: (value: string) => void
  onToday?: () => void
  disabled?: boolean
  className?: string
}

type MonthNavigatorProps = {
  kind: "month"
  value: string
  onNavigate: (offset: number) => void
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

type YearNavigatorProps = {
  kind: "year"
  value: number
  onNavigate: (offset: number) => void
  disabled?: boolean
  className?: string
}

export type LogPeriodNavigatorProps =
  | DateNavigatorProps
  | MonthNavigatorProps
  | YearNavigatorProps

function formatDateLabel(value: string) {
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function parseMonthKey(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null
  return new Date(y, m - 1, 1)
}

function formatMonthLabel(value: string) {
  const d = parseMonthKey(value)
  if (!d) return value
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function LogPeriodNavigator(props: LogPeriodNavigatorProps) {
  const label = useMemo(() => {
    if (props.kind === "date") return formatDateLabel(props.value)
    if (props.kind === "month") return formatMonthLabel(props.value)
    return String(props.value)
  }, [props])

  const isTodayDate =
    props.kind === "date" && props.value === new Date().toISOString().slice(0, 10)

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", props.className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 md:size-8"
        onClick={() => props.onNavigate(-1)}
        disabled={props.disabled}
        aria-label={`Previous ${props.kind}`}
      >
        <ChevronLeft className="size-4" />
      </Button>

      {props.kind === "year" ? (
        <div className="inline-flex h-9 min-w-[88px] items-center justify-center rounded-md border px-2 text-xs font-medium tabular-nums md:h-8">
          {label}
        </div>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-1.5 px-2 text-xs font-medium md:h-8",
                props.kind === "date"
                  ? "min-w-[190px] justify-start"
                  : "min-w-[150px] justify-start"
              )}
              disabled={props.disabled}
            >
              <CalendarIcon className="size-3.5 text-muted-foreground" />
              <span className="truncate text-left">{label}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {props.kind === "date" && (
              <Calendar
                initialFocus
                mode="single"
                captionLayout="dropdown"
                startMonth={new Date(2020, 0, 1)}
                endMonth={new Date(2035, 11, 1)}
                selected={new Date(`${props.value}T00:00:00`)}
                onSelect={(date) => {
                  if (!date) return
                  props.onChange(toDateKey(date))
                }}
              />
            )}
            {props.kind === "month" && (
              <Calendar
                initialFocus
                mode="single"
                captionLayout="dropdown"
                startMonth={new Date(2020, 0, 1)}
                endMonth={new Date(2035, 11, 1)}
                defaultMonth={parseMonthKey(props.value) ?? new Date()}
                selected={parseMonthKey(props.value) ?? undefined}
                onSelect={(date) => {
                  if (!date) return
                  props.onChange(toMonthKey(date))
                }}
              />
            )}
          </PopoverContent>
        </Popover>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 md:size-8"
        onClick={() => props.onNavigate(1)}
        disabled={props.disabled}
        aria-label={`Next ${props.kind}`}
      >
        <ChevronRight className="size-4" />
      </Button>

      {props.kind === "date" && props.onToday && !isTodayDate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-xs md:h-8"
          onClick={props.onToday}
          disabled={props.disabled}
        >
          Today
        </Button>
      )}
    </div>
  )
}
