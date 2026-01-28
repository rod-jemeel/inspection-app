"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"

interface DueRule {
  dayOfWeek?: number // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth?: number // 1-31
  month?: number // 1-12
}

interface Template {
  id: string
  task: string
  description: string | null
  frequency: "weekly" | "monthly" | "yearly" | "every_3_years"
  default_due_rule: DueRule | null
  active: boolean
  sort_order: number
  created_by: string | null
  created_by_name?: string | null
  updated_by: string | null
  updated_by_name?: string | null
  created_at: string
  updated_at: string
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
]

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationId: string
  template?: Template | null
  onSuccess?: (template: Template) => void
}

export function TemplateDialog({
  open,
  onOpenChange,
  locationId,
  template,
  onSuccess,
}: TemplateDialogProps) {
  const router = useRouter()
  const isEditing = !!template
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [task, setTask] = useState("")
  const [description, setDescription] = useState("")
  const [frequency, setFrequency] = useState<string>("weekly")
  const [active, setActive] = useState(true)

  // Due rule fields
  const [dayOfWeek, setDayOfWeek] = useState<number>(1) // Monday default
  const [dayOfMonth, setDayOfMonth] = useState<number>(1)
  const [month, setMonth] = useState<number>(1)

  useEffect(() => {
    if (open) {
      if (template) {
        setTask(template.task)
        setDescription(template.description ?? "")
        setFrequency(template.frequency)
        setActive(template.active)
        // Set due rule values
        const rule = template.default_due_rule
        setDayOfWeek(rule?.dayOfWeek ?? 1)
        setDayOfMonth(rule?.dayOfMonth ?? 1)
        setMonth(rule?.month ?? 1)
      } else {
        setTask("")
        setDescription("")
        setFrequency("weekly")
        setActive(true)
        setDayOfWeek(1)
        setDayOfMonth(1)
        setMonth(1)
      }
      setError(null)
    }
  }, [open, template])

  // Build due rule based on frequency
  const buildDueRule = (): DueRule | undefined => {
    switch (frequency) {
      case "weekly":
        return { dayOfWeek }
      case "monthly":
        return { dayOfMonth }
      case "yearly":
      case "every_3_years":
        return { month, dayOfMonth }
      default:
        return undefined
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const default_due_rule = buildDueRule()
      const body = isEditing
        ? { task, description: description || undefined, frequency, default_due_rule, active }
        : { task, description: description || undefined, frequency, default_due_rule }

      const url = isEditing
        ? `/api/locations/${locationId}/templates/${template.id}`
        : `/api/locations/${locationId}/templates`
      const method = isEditing ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error?.message ?? "Something went wrong")
        return
      }

      const { data } = await res.json()
      onSuccess?.(data)
      onOpenChange(false)
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? "Edit Template" : "New Template"}
            {isEditing && template && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Info className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    <div className="space-y-1">
                      <p>
                        <span className="font-medium">Created:</span>{" "}
                        {new Date(template.created_at).toLocaleDateString()}{" "}
                        {template.created_by_name && `by ${template.created_by_name}`}
                      </p>
                      {template.updated_at !== template.created_at && (
                        <p>
                          <span className="font-medium">Updated:</span>{" "}
                          {new Date(template.updated_at).toLocaleDateString()}{" "}
                          {template.updated_by_name && `by ${template.updated_by_name}`}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel>Task Name</FieldLabel>
            <Input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g., Fire extinguisher check"
              required
              maxLength={255}
              disabled={loading}
              autoComplete="off"
            />
          </Field>

          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              placeholder="Detailed instructions..."
              maxLength={2000}
              rows={3}
              disabled={loading}
              className="rounded-md text-xs"
              autoComplete="off"
            />
            <FieldDescription>Optional detailed instructions</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Frequency</FieldLabel>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
              disabled={loading}
              aria-label="Frequency"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="every_3_years">Every 3 Years</option>
            </select>
          </Field>

          {/* Due Rule Fields - conditional based on frequency */}
          {frequency === "weekly" && (
            <Field>
              <FieldLabel>Due Day</FieldLabel>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                disabled={loading}
                aria-label="Day of week"
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
              <FieldDescription>Which day of the week is this due?</FieldDescription>
            </Field>
          )}

          {frequency === "monthly" && (
            <Field>
              <FieldLabel>Due Day of Month</FieldLabel>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                disabled={loading}
                aria-label="Day of month"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                    {day === 31 && " (or last day)"}
                  </option>
                ))}
              </select>
              <FieldDescription>Which day of the month is this due?</FieldDescription>
            </Field>
          )}

          {(frequency === "yearly" || frequency === "every_3_years") && (
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Due Month</FieldLabel>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                  disabled={loading}
                  aria-label="Month"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel>Due Day</FieldLabel>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                  disabled={loading}
                  aria-label="Day"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {isEditing && (
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel className="mb-0">Active</FieldLabel>
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={loading}
                />
              </div>
              <FieldDescription>
                Inactive templates won&apos;t generate new inspection instances
              </FieldDescription>
            </Field>
          )}

          {error && <FieldError>{error}</FieldError>}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
