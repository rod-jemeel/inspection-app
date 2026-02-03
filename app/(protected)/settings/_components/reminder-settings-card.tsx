"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock03Icon } from "hugeicons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { ReminderSettings } from "@/lib/validations/reminder-settings"

interface ReminderSettingsCardProps {
  initialSettings: ReminderSettings
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
    <Card className="md:col-span-2 lg:col-span-3">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock03Icon className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm">Reminder Schedule</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Configure when inspection reminders are sent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-none border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-none border border-green-500/50 bg-green-500/10 p-3 text-xs text-green-600">
              Settings saved successfully
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Weekly */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weekly</h4>
              <div className="space-y-2 rounded-none border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="weekly_due_day" className="text-xs">Remind on due day</Label>
                  <Switch
                    id="weekly_due_day"
                    checked={formData.weekly_due_day}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, weekly_due_day: checked }))}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            {/* Monthly */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly</h4>
              <div className="space-y-3 rounded-none border bg-muted/30 p-3">
                <div className="space-y-1">
                  <Label htmlFor="monthly_days_before" className="text-xs">Days before due</Label>
                  <Input
                    id="monthly_days_before"
                    type="number"
                    min="1"
                    max="30"
                    value={formData.monthly_days_before}
                    onChange={(e) => setFormData((prev) => ({ ...prev, monthly_days_before: parseInt(e.target.value) || 7 }))}
                    disabled={isSaving}
                    className="h-8"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="monthly_due_day" className="text-xs">Remind on due day</Label>
                  <Switch
                    id="monthly_due_day"
                    checked={formData.monthly_due_day}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, monthly_due_day: checked }))}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            {/* Yearly */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Yearly</h4>
              <div className="space-y-3 rounded-none border bg-muted/30 p-3">
                <div className="space-y-1">
                  <Label htmlFor="yearly_months_before" className="text-xs">Months before due</Label>
                  <Input
                    id="yearly_months_before"
                    type="number"
                    min="1"
                    max="12"
                    value={formData.yearly_months_before}
                    onChange={(e) => setFormData((prev) => ({ ...prev, yearly_months_before: parseInt(e.target.value) || 6 }))}
                    disabled={isSaving}
                    className="h-8"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="yearly_monthly_reminder" className="text-xs">Monthly reminders</Label>
                  <Switch
                    id="yearly_monthly_reminder"
                    checked={formData.yearly_monthly_reminder}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, yearly_monthly_reminder: checked }))}
                    disabled={isSaving}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="yearly_due_day" className="text-xs">Remind on due day</Label>
                  <Switch
                    id="yearly_due_day"
                    checked={formData.yearly_due_day}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, yearly_due_day: checked }))}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            {/* Every 3 Years */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Every 3 Years</h4>
              <div className="space-y-3 rounded-none border bg-muted/30 p-3">
                <div className="space-y-1">
                  <Label htmlFor="three_year_months_before" className="text-xs">Months before due</Label>
                  <Input
                    id="three_year_months_before"
                    type="number"
                    min="1"
                    max="12"
                    value={formData.three_year_months_before}
                    onChange={(e) => setFormData((prev) => ({ ...prev, three_year_months_before: parseInt(e.target.value) || 6 }))}
                    disabled={isSaving}
                    className="h-8"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="three_year_monthly_reminder" className="text-xs">Monthly reminders</Label>
                  <Switch
                    id="three_year_monthly_reminder"
                    checked={formData.three_year_monthly_reminder}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, three_year_monthly_reminder: checked }))}
                    disabled={isSaving}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="three_year_due_day" className="text-xs">Remind on due day</Label>
                  <Switch
                    id="three_year_due_day"
                    checked={formData.three_year_due_day}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, three_year_due_day: checked }))}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving} size="sm">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
