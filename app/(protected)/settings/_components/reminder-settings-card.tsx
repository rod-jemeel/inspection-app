"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ReminderSettings } from "@/lib/validations/reminder-settings"

interface ReminderSettingsCardProps {
  initialSettings: ReminderSettings
}

interface ReminderGroupProps {
  title: string
  description: string
  children: React.ReactNode
}

function ReminderGroup({ title, description, children }: ReminderGroupProps) {
  return (
    <section className="grid gap-4 border-t border-border/70 py-5 first:border-t-0 first:pt-0 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <header className="space-y-1">
        <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

interface ToggleRowProps {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

function ToggleRow({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}

export function ReminderSettingsCard({ initialSettings }: ReminderSettingsCardProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    weekly_due_day: initialSettings.weekly_due_day,
    monthly_days_before: initialSettings.monthly_days_before,
    monthly_due_day: initialSettings.monthly_due_day,
    yearly_months_before: initialSettings.yearly_months_before,
    yearly_monthly_reminder: initialSettings.yearly_monthly_reminder,
    yearly_due_day: initialSettings.yearly_due_day,
    three_year_months_before: initialSettings.three_year_months_before,
    three_year_monthly_reminder: initialSettings.three_year_monthly_reminder,
    three_year_due_day: initialSettings.three_year_due_day,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsSaving(true)

    try {
      const response = await fetch("/api/settings/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || "Failed to update settings")
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs text-primary">
          Reminder settings saved successfully.
        </div>
      ) : null}

      <ReminderGroup
        title="Weekly"
        description="Simple due-day reminders for weekly work."
      >
        <ToggleRow
          id="weekly_due_day"
          label="Remind on due day"
          checked={formData.weekly_due_day}
          disabled={isSaving}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, weekly_due_day: checked }))
          }
        />
      </ReminderGroup>

      <ReminderGroup
        title="Monthly"
        description="Control lead time for forms that reset every month."
      >
        <div className="grid gap-2 sm:grid-cols-[11rem_minmax(0,10rem)] sm:items-center">
          <Label htmlFor="monthly_days_before" className="text-xs font-medium text-foreground">
            Days before due
          </Label>
          <Input
            id="monthly_days_before"
            type="number"
            min="1"
            max="30"
            value={formData.monthly_days_before}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                monthly_days_before: Number.parseInt(e.target.value, 10) || 7,
              }))
            }
            disabled={isSaving}
            className="h-8"
          />
        </div>
        <ToggleRow
          id="monthly_due_day"
          label="Remind on due day"
          checked={formData.monthly_due_day}
          disabled={isSaving}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, monthly_due_day: checked }))
          }
        />
      </ReminderGroup>

      <ReminderGroup
        title="Yearly"
        description="Stagger reminders for annual compliance cycles."
      >
        <div className="grid gap-2 sm:grid-cols-[11rem_minmax(0,10rem)] sm:items-center">
          <Label htmlFor="yearly_months_before" className="text-xs font-medium text-foreground">
            Months before due
          </Label>
          <Input
            id="yearly_months_before"
            type="number"
            min="1"
            max="12"
            value={formData.yearly_months_before}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                yearly_months_before: Number.parseInt(e.target.value, 10) || 6,
              }))
            }
            disabled={isSaving}
            className="h-8"
          />
        </div>
        <ToggleRow
          id="yearly_monthly_reminder"
          label="Monthly reminders"
          checked={formData.yearly_monthly_reminder}
          disabled={isSaving}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, yearly_monthly_reminder: checked }))
          }
        />
        <ToggleRow
          id="yearly_due_day"
          label="Remind on due day"
          checked={formData.yearly_due_day}
          disabled={isSaving}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, yearly_due_day: checked }))
          }
        />
      </ReminderGroup>

      <ReminderGroup
        title="Every 3 Years"
        description="Long-cycle inspection reminders with monthly nudges."
      >
        <div className="grid gap-2 sm:grid-cols-[11rem_minmax(0,10rem)] sm:items-center">
          <Label htmlFor="three_year_months_before" className="text-xs font-medium text-foreground">
            Months before due
          </Label>
          <Input
            id="three_year_months_before"
            type="number"
            min="1"
            max="12"
            value={formData.three_year_months_before}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                three_year_months_before: Number.parseInt(e.target.value, 10) || 6,
              }))
            }
            disabled={isSaving}
            className="h-8"
          />
        </div>
        <ToggleRow
          id="three_year_monthly_reminder"
          label="Monthly reminders"
          checked={formData.three_year_monthly_reminder}
          disabled={isSaving}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, three_year_monthly_reminder: checked }))
          }
        />
        <ToggleRow
          id="three_year_due_day"
          label="Remind on due day"
          checked={formData.three_year_due_day}
          disabled={isSaving}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, three_year_due_day: checked }))
          }
        />
      </ReminderGroup>

      <div className="flex justify-end border-t border-border/70 pt-4">
        <Button type="submit" disabled={isSaving} size="sm">
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  )
}
