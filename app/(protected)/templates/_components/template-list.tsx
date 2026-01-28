"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, PencilSimple, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"

interface Template {
  id: string
  task: string
  description: string | null
  frequency: "weekly" | "monthly" | "yearly" | "every_3_years"
  active: boolean
  created_at: string
}

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  every_3_years: "Every 3 Years",
}

export function TemplateList({
  templates: initialTemplates,
  locationId,
  canManage,
}: {
  templates: Template[]
  locationId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Form state
  const [task, setTask] = useState("")
  const [description, setDescription] = useState("")
  const [frequency, setFrequency] = useState<string>("weekly")

  const resetForm = () => {
    setTask("")
    setDescription("")
    setFrequency("weekly")
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  const startEdit = (t: Template) => {
    setTask(t.task)
    setDescription(t.description ?? "")
    setFrequency(t.frequency)
    setEditingId(t.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const body = { task, description: description || undefined, frequency }
      const url = editingId
        ? `/api/locations/${locationId}/templates/${editingId}`
        : `/api/locations/${locationId}/templates`
      const method = editingId ? "PUT" : "POST"

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
      if (editingId) {
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? data : t)))
      } else {
        setTemplates((prev) => [data, ...prev])
      }
      resetForm()
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium">Templates</h1>
        {canManage && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus weight="bold" className="size-3.5" />
            New Template
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Template" : "New Template"}</CardTitle>
            <CardAction>
              <Button variant="ghost" size="icon-xs" onClick={resetForm}>
                <X weight="bold" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
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
                />
              </Field>
              <Field>
                <FieldLabel>Description (optional)</FieldLabel>
                <Textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Detailed instructions..."
                  maxLength={2000}
                  rows={3}
                  disabled={loading}
                  className="rounded-none text-xs"
                />
              </Field>
              <Field>
                <FieldLabel>Frequency</FieldLabel>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs"
                  disabled={loading}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="every_3_years">Every 3 Years</option>
                </select>
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={resetForm} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {templates.length === 0 ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          No templates yet. {canManage && "Create your first template to get started."}
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t.task}
                  <Badge variant="outline" className={cn(!t.active && "opacity-50")}>
                    {FREQ_LABELS[t.frequency]}
                  </Badge>
                  {!t.active && (
                    <Badge variant="outline" className="opacity-50">
                      Inactive
                    </Badge>
                  )}
                </CardTitle>
                {canManage && (
                  <CardAction>
                    <Button variant="ghost" size="icon-xs" onClick={() => startEdit(t)}>
                      <PencilSimple weight="bold" />
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              {t.description && (
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
