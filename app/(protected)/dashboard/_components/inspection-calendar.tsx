"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQueryState } from "nuqs"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  CalendarDays,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  MapPin,
  FileText,
  ArrowLeft,
  Calendar,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import "@schedule-x/theme-default/dist/index.css"

interface CalendarEvent {
  id: string
  task: string
  description?: string | null
  dueAt: string
  status: "pending" | "in_progress" | "failed" | "passed" | "void"
  assignee: string | null
  frequency: string | null
  passedAt?: string | null
  failedAt?: string | null
  locationName?: string | null
}

interface InspectionCalendarProps {
  events: CalendarEvent[]
  locationId: string
  locationName?: string
}

function getStatusBadge(status: string, isOverdue: boolean) {
  if (isOverdue) {
    return { label: "Overdue", variant: "destructive" as const, className: "bg-red-100 text-red-700 border-red-200" }
  }
  switch (status) {
    case "passed":
      return { label: "Passed", variant: "default" as const, className: "bg-green-100 text-green-700 border-green-200" }
    case "failed":
      return { label: "Failed", variant: "destructive" as const, className: "bg-red-100 text-red-700 border-red-200" }
    case "in_progress":
      return { label: "In Progress", variant: "secondary" as const, className: "bg-amber-100 text-amber-700 border-amber-200" }
    case "void":
      return { label: "Void", variant: "outline" as const, className: "bg-muted text-muted-foreground" }
    default:
      return { label: "Pending", variant: "secondary" as const, className: "bg-blue-100 text-blue-700 border-blue-200" }
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatFrequency(freq: string | null): string {
  if (!freq) return "One-time"
  const labels: Record<string, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    every_3_years: "Every 3 Years",
  }
  return labels[freq] || freq
}

// Get the previous Friday for a Monday task (for advance warning)
function getPreviousFriday(date: Date): Date {
  const friday = new Date(date)
  friday.setDate(friday.getDate() - 3) // Monday - 3 = Friday
  return friday
}

// Check if a Monday task should show Friday warning
function shouldShowFridayWarning(dueDate: Date, status: string): boolean {
  if (status !== "pending" && status !== "in_progress") return false

  const now = new Date()
  const dueDay = dueDate.getDay()

  // Only applies to Monday tasks
  if (dueDay !== 1) return false

  // Check if we're on the Friday before
  const friday = getPreviousFriday(dueDate)
  const isFridayBefore =
    now.getFullYear() === friday.getFullYear() &&
    now.getMonth() === friday.getMonth() &&
    now.getDate() === friday.getDate()

  return isFridayBefore
}

export function InspectionCalendar({ events, locationId, locationName }: InspectionCalendarProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // URL state with nuqs
  const [calendarDate, setCalendarDate] = useQueryState("calDate", {
    defaultValue: "",
    clearOnDefault: true,
  })
  const [calendarEvent, setCalendarEvent] = useQueryState("calEvent", {
    defaultValue: "",
    clearOnDefault: true,
  })

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([])
  const [modalMode, setModalMode] = useState<"single" | "list">("single")
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Current view date for navigation
  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Derive modal open state from URL params
  const isModalOpen = !!calendarDate || !!calendarEvent

  // Memoize events to prevent calendar re-initialization on modal interactions
  const eventsKey = events.map(e => e.id).join(",")
  const stableEvents = useMemo(() => events, [eventsKey])

  // Create a map for quick event lookup
  const eventMap = useRef<Map<string, CalendarEvent>>(new Map())

  useEffect(() => {
    eventMap.current.clear()
    stableEvents.forEach((event) => {
      eventMap.current.set(event.id, event)
    })
  }, [stableEvents])

  // Fetch events for a specific date from API
  const fetchEventsForDate = useCallback(async (dateStr: string) => {
    setIsLoadingEvents(true)
    setLoadError(null)
    setCalendarDate(dateStr)
    setCalendarEvent("") // Clear event selection
    setModalMode("list")

    try {
      const response = await fetch(`/api/locations/${locationId}/calendar/${dateStr}`)
      if (!response.ok) {
        throw new Error("Failed to load events")
      }
      const data = await response.json()
      setSelectedDateEvents(data.events ?? [])
    } catch {
      // Fallback to local data if API fails
      const dateEvents = stableEvents.filter((event) => {
        const eventDate = new Date(event.dueAt).toISOString().split("T")[0]
        return eventDate === dateStr
      })
      setSelectedDateEvents(dateEvents)
      if (dateEvents.length === 0) {
        setLoadError("No events found for this date")
      }
    } finally {
      setIsLoadingEvents(false)
    }
  }, [stableEvents, locationId, setCalendarDate, setCalendarEvent])

  const handleEventClick = useCallback((eventId: string) => {
    const event = eventMap.current.get(eventId)
    if (event) {
      setSelectedEvent(event)
      setSelectedDateEvents([]) // Clear list to hide back button
      setModalMode("single")
      setCalendarEvent(eventId)
      setCalendarDate("") // Clear date selection
    }
  }, [setCalendarEvent, setCalendarDate])

  const handleDateClick = useCallback((dateStr: string) => {
    fetchEventsForDate(dateStr)
  }, [fetchEventsForDate])

  const handleCloseModal = useCallback(() => {
    setCalendarDate("")
    setCalendarEvent("")
    setSelectedEvent(null)
    setSelectedDateEvents([])
  }, [setCalendarDate, setCalendarEvent])

  const handleViewDetails = (eventId: string) => {
    handleCloseModal()
    router.push(`/inspections?loc=${locationId}&instance=${eventId}`)
  }

  const handleSelectEventFromList = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setModalMode("single")
    setCalendarEvent(event.id)
  }

  const handleBackToList = () => {
    setSelectedEvent(null)
    setModalMode("list")
    setCalendarEvent("")
  }

  // Initialize from URL params on mount
  useEffect(() => {
    if (calendarEvent && !selectedEvent) {
      const event = eventMap.current.get(calendarEvent)
      if (event) {
        setSelectedEvent(event)
        setModalMode("single")
      }
    } else if (calendarDate && selectedDateEvents.length === 0 && !isLoadingEvents) {
      fetchEventsForDate(calendarDate)
    }
  }, [calendarEvent, calendarDate, selectedEvent, selectedDateEvents.length, isLoadingEvents, fetchEventsForDate])

  const now = useMemo(() => new Date(), [])

  // Memoize calendar event transformation to prevent re-renders
  const calendarEventsData = useMemo(() => {
    return stableEvents.map((event) => {
      const dueDate = new Date(event.dueAt)
      const isOverdue =
        (event.status === "pending" || event.status === "in_progress") &&
        dueDate < now
      const hasFridayWarning = shouldShowFridayWarning(dueDate, event.status)

      const dateStr = dueDate.toISOString().split("T")[0]

      return {
        id: event.id,
        title: event.task || "Inspection",
        start: dateStr,
        end: dateStr,
        isOverdue,
        hasFridayWarning,
        status: event.status,
      }
    })
  }, [stableEvents, now])

  // Stable callbacks using refs to avoid re-initialization
  const handleEventClickRef = useRef(handleEventClick)
  const handleDateClickRef = useRef(handleDateClick)

  useEffect(() => {
    handleEventClickRef.current = handleEventClick
    handleDateClickRef.current = handleDateClick
  }, [handleEventClick, handleDateClick])

  useEffect(() => {
    let mounted = true

    async function initCalendar() {
      if (!containerRef.current) return

      try {
        await import("temporal-polyfill/global")

        const [calendarModule, eventsModule] = await Promise.all([
          import("@schedule-x/calendar"),
          import("@schedule-x/events-service"),
        ])

        if (!mounted) return

        const Temporal = (globalThis as any).Temporal
        if (!Temporal) {
          throw new Error("Temporal polyfill not loaded")
        }

        const { createCalendar, createViewMonthGrid } = calendarModule
        const { createEventsServicePlugin } = eventsModule

        // Transform to calendar format with Temporal dates
        const calendarEvents = calendarEventsData.map((event) => ({
          id: event.id,
          title: event.title,
          start: Temporal.PlainDate.from(event.start),
          end: Temporal.PlainDate.from(event.end),
          _options: {
            additionalClasses: [
              `status-${event.isOverdue ? "overdue" : event.status}`,
              event.hasFridayWarning ? "friday-warning" : "",
            ].filter(Boolean),
          },
        }))

        if (calendarRef.current?.destroy) {
          calendarRef.current.destroy()
        }

        const isMobile = window.innerWidth < 640
        // On mobile, show max 5 dots; desktop shows 2 event titles + "+N more" button
        const nEventsPerDay = isMobile ? 5 : 2

        // Get the date for initial view using Temporal
        const viewDateStr = viewDate.toISOString().split("T")[0]
        const selectedDate = Temporal.PlainDate.from(viewDateStr)

        const calendar = createCalendar({
          views: [createViewMonthGrid()],
          events: calendarEvents,
          plugins: [createEventsServicePlugin()],
          // Sunday-first calendar (US format: Sun, Mon, Tue, Wed, Thu, Fri, Sat)
          // ISO week: 1=Monday, 7=Sunday
          firstDayOfWeek: 7 as any,
          selectedDate,
          callbacks: {
            onEventClick: (calendarEvent: any) => {
              handleEventClickRef.current(calendarEvent.id)
            },
            onClickPlusEvents: (date: any) => {
              const dateStr = date.toString()
              handleDateClickRef.current(dateStr)
            },
            onClickDate: (date: any) => {
              const dateStr = date.toString()
              handleDateClickRef.current(dateStr)
            },
          },
          monthGridOptions: {
            nEventsPerDay,
          },
        })

        if (containerRef.current) {
          containerRef.current.innerHTML = ""
          calendar.render(containerRef.current)
          calendarRef.current = calendar

          // On mobile, simplify "+N events" buttons to just "+N"
          if (isMobile) {
            const simplifyMoreButtons = () => {
              const buttons = containerRef.current?.querySelectorAll('.sx__month-grid-more-button')
              buttons?.forEach((btn) => {
                const text = btn.textContent || ''
                // Extract number from "+ N events" or "+ N event"
                const match = text.match(/\+\s*(\d+)/)
                if (match) {
                  btn.textContent = `+${match[1]}`
                }
              })
            }
            // Run immediately and observe for changes
            simplifyMoreButtons()
            const observer = new MutationObserver(simplifyMoreButtons)
            observer.observe(containerRef.current, { childList: true, subtree: true })
            // Cleanup observer on calendar destroy
            const originalDestroy = calendar.destroy?.bind(calendar)
            calendar.destroy = () => {
              observer.disconnect()
              originalDestroy?.()
            }
          }
        }

        setIsLoading(false)
      } catch (err) {
        console.error("Calendar init error:", err)
        setError(err instanceof Error ? err.message : "Failed to load calendar")
        setIsLoading(false)
      }
    }

    initCalendar()

    return () => {
      mounted = false
      if (calendarRef.current?.destroy) {
        calendarRef.current.destroy()
      }
    }
  }, [calendarEventsData, locationId, viewDate])

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        Failed to load calendar
      </div>
    )
  }

  const selectedEventIsOverdue = selectedEvent
    ? (selectedEvent.status === "pending" || selectedEvent.status === "in_progress") &&
      new Date(selectedEvent.dueAt) < now
    : false

  // Navigate calendar to a specific date
  const navigateToDate = useCallback((date: Date) => {
    setViewDate(date)
    if (calendarRef.current) {
      try {
        // Schedule-x uses different navigation methods
        const dateStr = date.toISOString().split("T")[0]
        if (typeof calendarRef.current.setDate === "function") {
          calendarRef.current.setDate(dateStr)
        } else if (typeof calendarRef.current.goTo === "function") {
          calendarRef.current.goTo(dateStr)
        }
      } catch {
        // Fallback: calendar will sync via viewDate state on next render
      }
    }
  }, [])

  const goToToday = useCallback(() => {
    navigateToDate(new Date())
  }, [navigateToDate])

  const goToPrevMonth = useCallback(() => {
    setViewDate((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() - 1)
      return newDate
    })
    if (calendarRef.current?.goToPreviousMonth) {
      calendarRef.current.goToPreviousMonth()
    }
  }, [])

  const goToNextMonth = useCallback(() => {
    setViewDate((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + 1)
      return newDate
    })
    if (calendarRef.current?.goToNextMonth) {
      calendarRef.current.goToNextMonth()
    }
  }, [])

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      navigateToDate(date)
      setDatePickerOpen(false)
    }
  }, [navigateToDate])

  // Format current view date for display
  const viewDateLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <>
      <div className="inspection-calendar rounded-lg border bg-card">
        {/* Custom Calendar Header */}
        <div className="flex items-center justify-between border-b px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 sm:size-8"
              onClick={goToPrevMonth}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 sm:size-8"
              onClick={goToNextMonth}
            >
              <ChevronRight className="size-4" />
            </Button>
            <span className="ml-1 text-sm font-semibold sm:ml-2 sm:text-base">
              {viewDateLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
              onClick={goToToday}
            >
              Today
            </Button>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 sm:size-8"
                >
                  <Calendar className="size-3.5 sm:size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarPicker
                  mode="single"
                  selected={viewDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isLoading && (
          <div className="p-4">
            {/* Calendar skeleton */}
            <div className="space-y-3">
              {/* Day names row */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={`day-${i}`} className="h-4" />
                ))}
              </div>
              {/* Calendar grid - 6 rows */}
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <div key={`row-${rowIndex}`} className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, colIndex) => (
                    <Skeleton
                      key={`cell-${rowIndex}-${colIndex}`}
                      className="aspect-square h-auto min-h-[40px] sm:min-h-[60px]"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div
          ref={containerRef}
          className={cn(
            "w-full",
            isLoading && "hidden"
          )}
        />
      </div>

      {/* Event Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          {/* Single Event Detail View */}
          {modalMode === "single" && selectedEvent && (
            <div className="flex flex-col">
              {/* Header with back button if came from list */}
              <div className="border-b bg-muted/30 px-4 py-3 pr-12">
                <div className="flex items-center gap-3">
                  {selectedDateEvents.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-7 shrink-0 px-2"
                      onClick={handleBackToList}
                    >
                      <ArrowLeft className="size-3.5" />
                    </Button>
                  )}
                  <div className="min-w-0 flex-1">
                    <DialogHeader className="space-y-0.5 text-left">
                      <DialogTitle className="text-sm font-semibold leading-tight">
                        {selectedEvent.task}
                      </DialogTitle>
                      {selectedEvent.description && selectedEvent.description.length <= 100 && (
                        <DialogDescription className="text-xs line-clamp-1">
                          {selectedEvent.description}
                        </DialogDescription>
                      )}
                    </DialogHeader>
                  </div>
                  <Badge
                    variant={getStatusBadge(selectedEvent.status, selectedEventIsOverdue).variant}
                    className={cn(
                      "shrink-0 text-[10px]",
                      getStatusBadge(selectedEvent.status, selectedEventIsOverdue).className
                    )}
                  >
                    {getStatusBadge(selectedEvent.status, selectedEventIsOverdue).label}
                  </Badge>
                </div>
              </div>

              {/* Details Grid */}
              <div className="space-y-0 divide-y">
                {/* Location */}
                {(locationName || selectedEvent.locationName) && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                      <MapPin className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Location
                      </div>
                      <div className="text-xs font-medium">
                        {selectedEvent.locationName || locationName}
                      </div>
                    </div>
                  </div>
                )}

                {/* Due Date */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    "flex size-8 items-center justify-center rounded-md",
                    selectedEventIsOverdue ? "bg-destructive/10" : "bg-muted"
                  )}>
                    <CalendarDays className={cn(
                      "size-4",
                      selectedEventIsOverdue ? "text-destructive" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Due Date
                    </div>
                    <div className={cn(
                      "text-xs font-medium",
                      selectedEventIsOverdue && "text-destructive"
                    )}>
                      {formatDate(selectedEvent.dueAt)}
                      {selectedEventIsOverdue && (
                        <span className="ml-2 text-[10px] font-normal">(overdue)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Frequency */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                    <Clock className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Frequency
                    </div>
                    <div className="text-xs font-medium">
                      {formatFrequency(selectedEvent.frequency)}
                    </div>
                  </div>
                </div>

                {/* Assignee */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Assigned To
                    </div>
                    <div className={cn(
                      "truncate text-xs font-medium",
                      !selectedEvent.assignee && "text-muted-foreground italic"
                    )}>
                      {selectedEvent.assignee || "Unassigned"}
                    </div>
                  </div>
                </div>

                {/* Description (full section if longer) */}
                {selectedEvent.description && selectedEvent.description.length > 100 && (
                  <div className="px-4 py-3">
                    <div className="mb-2 flex items-center gap-2">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Description
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                {/* Friday Warning for Monday tasks */}
                {shouldShowFridayWarning(new Date(selectedEvent.dueAt), selectedEvent.status) && (
                  <div className="bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <div className="text-xs text-amber-700 dark:text-amber-300">
                        <span className="font-medium">Heads up!</span> This task is due Monday.
                        Complete it before the weekend to avoid delays.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="border-t bg-muted/20 p-4">
                <Button
                  className="w-full gap-2"
                  size="sm"
                  onClick={() => handleViewDetails(selectedEvent.id)}
                >
                  <ExternalLink className="size-3.5" />
                  View Full Details
                </Button>
              </div>
            </div>
          )}

          {/* List View */}
          {modalMode === "list" && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="border-b bg-muted/30 px-4 py-3 pr-12">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-sm font-semibold">
                    {calendarDate ? formatDate(`${calendarDate}T00:00:00`) : "Events"}
                  </DialogTitle>
                  {!isLoadingEvents && selectedDateEvents.length > 0 && (
                    <DialogDescription className="text-xs">
                      {selectedDateEvents.length} inspection{selectedDateEvents.length !== 1 ? "s" : ""} scheduled
                    </DialogDescription>
                  )}
                </DialogHeader>
              </div>

              {/* Loading state */}
              {isLoadingEvents && (
                <div className="space-y-0 divide-y p-0" role="status" aria-label="Loading events">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="size-10 rounded-md bg-neutral-200 dark:bg-neutral-700" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4 bg-neutral-200 dark:bg-neutral-700" />
                        <Skeleton className="h-2 w-1/2 bg-neutral-200 dark:bg-neutral-700" />
                      </div>
                      <Skeleton className="size-5 bg-neutral-200 dark:bg-neutral-700" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error state */}
              {!isLoadingEvents && loadError && (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                    <AlertTriangle className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">{loadError}</p>
                </div>
              )}

              {/* Empty state */}
              {!isLoadingEvents && !loadError && selectedDateEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                    <CalendarDays className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium">No inspections scheduled</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This date has no scheduled inspections
                  </p>
                </div>
              )}

              {/* Event list */}
              {!isLoadingEvents && selectedDateEvents.length > 0 && (
                <div className="max-h-[400px] divide-y overflow-y-auto overscroll-contain">
                  {selectedDateEvents.map((event) => {
                    const isOverdue =
                      (event.status === "pending" || event.status === "in_progress") &&
                      new Date(event.dueAt) < now
                    const statusBadge = getStatusBadge(event.status, isOverdue)

                    return (
                      <button
                        key={event.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                        onClick={() => handleSelectEventFromList(event)}
                      >
                        {/* Status indicator */}
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-md border shadow-sm",
                            statusBadge.className
                          )}
                        >
                          {isOverdue ? (
                            <AlertTriangle className="size-4" />
                          ) : event.status === "passed" ? (
                            <CalendarDays className="size-4" />
                          ) : event.status === "failed" ? (
                            <AlertTriangle className="size-4" />
                          ) : (
                            <Clock className="size-4" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-medium">
                              {event.task}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                            {event.assignee && (
                              <span className="flex items-center gap-1">
                                <User className="size-3" />
                                <span className="truncate">{event.assignee}</span>
                              </span>
                            )}
                            {event.frequency && (
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                <span>{formatFrequency(event.frequency)}</span>
                              </span>
                            )}
                            {(locationName || event.locationName) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3" />
                                <span className="truncate">{event.locationName || locationName}</span>
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                              {event.description}
                            </p>
                          )}
                        </div>

                        {/* Badge + Arrow */}
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            variant={statusBadge.variant}
                            className={cn("text-[9px]", statusBadge.className)}
                          >
                            {statusBadge.label}
                          </Badge>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom styles for calendar */}
      <style jsx global>{`
        /* Calendar container - override height: 100% to auto-size */
        .inspection-calendar .sx__calendar {
          border: none !important;
          background: transparent !important;
          height: auto !important;
        }
        .inspection-calendar .sx__month-grid-wrapper {
          height: auto !important;
          flex: none !important;
        }

        /* Make day cells clickable */
        .inspection-calendar .sx__month-grid-day {
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .inspection-calendar .sx__month-grid-day:hover {
          background-color: oklch(0.97 0 0);
        }
        .inspection-calendar .sx__month-grid-day:active {
          background-color: oklch(0.95 0 0);
        }

        /* Smaller date numbers */
        .inspection-calendar .sx__month-grid-day__header {
          font-size: 10px;
          padding: 2px 4px;
        }
        .inspection-calendar .sx__month-grid-day__header-date {
          font-size: 10px;
          font-weight: 500;
        }

        /* Day header row (Sun, Mon, etc.) */
        .inspection-calendar .sx__month-grid-week__header-day {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          padding: 4px 2px;
        }

        /* Hide default schedule-x header - we use custom header */
        .inspection-calendar .sx__calendar-header {
          display: none !important;
        }

        /* Day cells - contain overflow */
        .inspection-calendar .sx__month-grid-day {
          min-height: 44px;
          overflow: hidden;
          position: relative;
        }

        /* MOBILE: Show all events as small dots */
        @media (max-width: 640px) {
          /* Day cells */
          .inspection-calendar .sx__month-grid-day {
            min-height: 44px !important;
          }
          .inspection-calendar .sx__month-grid-day__header {
            font-size: 9px !important;
            padding: 1px 2px !important;
          }
          /* Events container */
          .inspection-calendar .sx__month-grid-day__events {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 2px !important;
            padding: 2px !important;
            justify-content: center !important;
            align-items: center !important;
          }
          /* Each event as a small dot */
          .inspection-calendar .sx__event {
            width: 6px !important;
            height: 6px !important;
            min-width: 6px !important;
            min-height: 6px !important;
            max-width: 6px !important;
            max-height: 6px !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 50% !important;
            border: none !important;
            border-left: none !important;
            font-size: 0 !important;
            line-height: 0 !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;
            text-indent: -9999px !important;
          }
          /* Dot colors by status */
          .inspection-calendar .sx__event.status-pending {
            background-color: oklch(0.55 0.15 264) !important;
          }
          .inspection-calendar .sx__event.status-in_progress {
            background-color: oklch(0.7 0.15 85) !important;
          }
          .inspection-calendar .sx__event.status-passed {
            background-color: oklch(0.55 0.18 145) !important;
          }
          .inspection-calendar .sx__event.status-failed,
          .inspection-calendar .sx__event.status-overdue {
            background-color: oklch(0.58 0.22 27) !important;
          }
          /* Fallback color for events without status class */
          .inspection-calendar .sx__event:not([class*="status-"]) {
            background-color: oklch(0.55 0.15 264) !important;
          }
          /* Hide "+N more" button on mobile - all dots shown */
          .inspection-calendar .sx__month-grid-more-button {
            display: none !important;
          }
        }

        /* DESKTOP: Show full event titles */
        @media (min-width: 640px) {
          .inspection-calendar .sx__month-grid-day {
            min-height: 90px;
            overflow: hidden;
          }
          .inspection-calendar .sx__month-grid-day__events {
            overflow: hidden;
            max-height: 62px;
          }
          .inspection-calendar .sx__month-grid-day__header {
            font-size: 12px;
          }
          .inspection-calendar .sx__month-grid-day__header-date {
            font-size: 12px;
          }
          .inspection-calendar .sx__month-grid-week__header-day {
            font-size: 10px;
          }
          .inspection-calendar .sx__event {
            font-size: 10px;
            padding: 1px 5px;
            border-radius: 3px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            transition: box-shadow 0.15s, transform 0.15s;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .inspection-calendar .sx__event:hover {
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            transform: translateY(-1px);
          }
          .inspection-calendar .sx__event.status-pending {
            background: oklch(0.95 0.03 264);
            border-left: 2px solid oklch(0.55 0.15 264);
            color: oklch(0.35 0.1 264);
          }
          .inspection-calendar .sx__event.status-in_progress {
            background: oklch(0.95 0.05 85);
            border-left: 2px solid oklch(0.7 0.15 85);
            color: oklch(0.4 0.1 85);
          }
          .inspection-calendar .sx__event.status-passed {
            background: oklch(0.95 0.04 145);
            border-left: 2px solid oklch(0.55 0.18 145);
            color: oklch(0.35 0.12 145);
          }
          .inspection-calendar .sx__event.status-failed,
          .inspection-calendar .sx__event.status-overdue {
            background: oklch(0.95 0.04 27);
            border-left: 2px solid oklch(0.58 0.22 27);
            color: oklch(0.4 0.15 27);
          }
          .inspection-calendar .sx__month-grid-more-button {
            font-size: 9px;
            padding: 1px 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
        }

        .inspection-calendar .sx__event.friday-warning {
          animation: pulse-warning 2s infinite;
        }
        @keyframes pulse-warning {
          0%, 100% { box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
          50% { box-shadow: 0 0 0 3px oklch(0.85 0.15 85 / 0.4); }
        }

        /* +N more button */
        .inspection-calendar .sx__month-grid-more-button {
          background: oklch(0.97 0 0);
          border: 1px solid oklch(0.9 0 0);
          border-radius: 3px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          transition: all 0.15s;
        }
        .inspection-calendar .sx__month-grid-more-button:hover {
          background: oklch(0.95 0 0);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>
    </>
  )
}
