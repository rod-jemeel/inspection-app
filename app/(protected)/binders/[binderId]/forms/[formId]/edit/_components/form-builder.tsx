"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, Plus, GripVertical, Pencil, Trash2, Eye, ChevronUp, ChevronDown, Save, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { AddFieldDialog } from "./add-field-dialog"

interface FormField {
  id: string
  form_template_id: string
  label: string
  field_type: string
  required: boolean
  options: string[] | null
  validation_rules: Record<string, unknown> | null
  help_text: string | null
  placeholder: string | null
  default_value: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

interface Binder {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  location_id: string
}

interface FormTemplate {
  id: string
  binder_id: string
  name: string
  description: string | null
  instructions: string | null
}

interface FormBuilderProps {
  binder: Binder
  template: FormTemplate
  fields: FormField[]
  locationId: string
}

const fieldTypeConfig: Record<string, { label: string; icon: string; color: string }> = {
  text: { label: "Short Text", icon: "T", color: "bg-blue-100 text-blue-700" },
  textarea: { label: "Long Text", icon: "¶", color: "bg-blue-100 text-blue-700" },
  number: { label: "Number", icon: "#", color: "bg-emerald-100 text-emerald-700" },
  date: { label: "Date", icon: "📅", color: "bg-purple-100 text-purple-700" },
  datetime: { label: "Date & Time", icon: "🕐", color: "bg-purple-100 text-purple-700" },
  boolean: { label: "Yes / No", icon: "✓", color: "bg-amber-100 text-amber-700" },
  select: { label: "Dropdown", icon: "▾", color: "bg-orange-100 text-orange-700" },
  multi_select: { label: "Checkboxes", icon: "☑", color: "bg-orange-100 text-orange-700" },
  temperature: { label: "Temperature", icon: "°", color: "bg-red-100 text-red-700" },
  pressure: { label: "Pressure", icon: "P", color: "bg-teal-100 text-teal-700" },
  signature: { label: "Signature", icon: "✍", color: "bg-gray-100 text-gray-700" },
  photo: { label: "Photo", icon: "📷", color: "bg-gray-100 text-gray-700" },
}

function FieldEditor({
  field,
  locationId,
  onSave,
  onCancel,
  saving,
}: {
  field: FormField
  locationId: string
  onSave: (updates: Partial<FormField>) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [label, setLabel] = useState(field.label)
  const [fieldType, setFieldType] = useState(field.field_type)
  const [required, setRequired] = useState(field.required)
  const [options, setOptions] = useState<string[]>(field.options || [])
  const [validationRules, setValidationRules] = useState<Record<string, unknown>>(field.validation_rules || {})
  const [helpText, setHelpText] = useState(field.help_text || "")
  const [placeholder, setPlaceholder] = useState(field.placeholder || "")
  const [defaultValue, setDefaultValue] = useState(field.default_value || "")

  const needsOptions = fieldType === "select" || fieldType === "multi_select"
  const needsValidation = fieldType === "number" || fieldType === "temperature" || fieldType === "pressure"

  const handleSave = () => {
    if (!label.trim()) {
      toast.error("Label is required")
      return
    }
    if (needsOptions && options.filter(o => o.trim()).length === 0) {
      toast.error("At least one option is required")
      return
    }

    onSave({
      label,
      field_type: fieldType,
      required,
      options: needsOptions ? options.filter(o => o.trim()) : null,
      validation_rules: needsValidation ? validationRules : null,
      help_text: helpText.trim() || null,
      placeholder: placeholder.trim() || null,
      default_value: defaultValue.trim() || null,
    })
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/50 p-4">
      <div className="space-y-2">
        <Label htmlFor="label" className="text-xs font-medium">Question Label</Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Enter question text"
          className="h-8 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="fieldType" className="text-xs font-medium">Field Type</Label>
          <Select value={fieldType} onValueChange={setFieldType}>
            <SelectTrigger id="fieldType" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(fieldTypeConfig).map(([type, config]) => (
                <SelectItem key={type} value={type} className="text-xs">
                  <span className="mr-1">{config.icon}</span> {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end space-x-2">
          <Label htmlFor="required" className="text-xs font-medium">Required</Label>
          <Switch id="required" checked={required} onCheckedChange={setRequired} />
        </div>
      </div>

      {needsOptions && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Options</Label>
          {options.map((opt, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={opt}
                onChange={(e) => {
                  const newOpts = [...options]
                  newOpts[idx] = e.target.value
                  setOptions(newOpts)
                }}
                placeholder={`Option ${idx + 1}`}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOptions([...options, ""])}
            className="h-8 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" /> Add Option
          </Button>
        </div>
      )}

      {needsValidation && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <Label htmlFor="min" className="text-xs font-medium">Min</Label>
            <Input
              id="min"
              type="number"
              value={(validationRules.min as number) ?? ""}
              onChange={(e) => setValidationRules({ ...validationRules, min: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max" className="text-xs font-medium">Max</Label>
            <Input
              id="max"
              type="number"
              value={(validationRules.max as number) ?? ""}
              onChange={(e) => setValidationRules({ ...validationRules, max: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="step" className="text-xs font-medium">Step</Label>
            <Input
              id="step"
              type="number"
              step="any"
              value={(validationRules.step as number) ?? ""}
              onChange={(e) => setValidationRules({ ...validationRules, step: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="helpText" className="text-xs font-medium">Help Text</Label>
        <Textarea
          id="helpText"
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          placeholder="Optional guidance for this field"
          className="min-h-[60px] text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="placeholder" className="text-xs font-medium">Placeholder</Label>
          <Input
            id="placeholder"
            value={placeholder}
            onChange={(e) => setPlaceholder(e.target.value)}
            placeholder="Placeholder text"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultValue" className="text-xs font-medium">Default Value</Label>
          <Input
            id="defaultValue"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="Default value"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving} className="h-8 text-xs">
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs">
          {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          Save
        </Button>
      </div>
    </div>
  )
}

export function FormBuilder({ binder, template, fields: initialFields, locationId }: FormBuilderProps) {
  const router = useRouter()
  const [fields, setFields] = useState(() => initialFields.filter(f => f.active).sort((a, b) => a.sort_order - b.sort_order))
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const handleFieldAdded = useCallback((field: FormField) => {
    setFields((prev) => [...prev, field])
  }, [])

  const handleSaveField = useCallback(async (fieldId: string, updates: Partial<FormField>) => {
    setSavingFieldId(fieldId)
    try {
      const response = await fetch(
        `/api/locations/${locationId}/forms/${template.id}/fields/${fieldId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update field")
      }

      const updated = await response.json()
      setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, ...updated } : f)))
      setExpandedFieldId(null)
      toast.success("Field updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update field")
    } finally {
      setSavingFieldId(null)
    }
  }, [locationId, template.id])

  const handleDeleteField = useCallback(async (fieldId: string) => {
    try {
      const response = await fetch(
        `/api/locations/${locationId}/forms/${template.id}/fields/${fieldId}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete field")
      }

      setFields((prev) => prev.filter((f) => f.id !== fieldId))
      toast.success("Field deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete field")
    } finally {
      setDeleteDialogOpen(false)
      setFieldToDelete(null)
    }
  }, [locationId, template.id])

  const handleReorder = useCallback(async (fieldId: string, direction: "up" | "down") => {
    const currentIndex = fields.findIndex((f) => f.id === fieldId)
    if (
      (direction === "up" && currentIndex === 0) ||
      (direction === "down" && currentIndex === fields.length - 1)
    ) {
      return
    }

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    const newFields = [...fields]
    const [moved] = newFields.splice(currentIndex, 1)
    newFields.splice(newIndex, 0, moved)

    setFields(newFields)

    try {
      const response = await fetch(
        `/api/locations/${locationId}/forms/${template.id}/fields/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field_ids: newFields.map((f) => f.id) }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to reorder fields")
      }

      toast.success("Field reordered")
    } catch (error) {
      setFields(fields)
      toast.error("Failed to reorder fields")
    }
  }, [fields, locationId, template.id])

  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push(`/binders/${binder.id}?loc=${locationId}`)}
            className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
            <span>{binder.name}</span>
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/binders/${binder.id}/forms/${template.id}?loc=${locationId}`)}
            className="h-7 text-xs"
          >
            <Eye className="mr-1 h-3 w-3" /> Preview
          </Button>
        </div>
        <div>
          <h1 className="text-sm font-medium">{template.name}</h1>
          {template.description && <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border bg-card shadow-sm">
            <div className="flex items-center gap-3 p-4">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{field.label}</span>
                  {field.required && <span className="text-xs text-red-500">*</span>}
                </div>
              </div>
              <Badge variant="secondary" className={cn("text-xs", fieldTypeConfig[field.field_type]?.color)}>
                {fieldTypeConfig[field.field_type]?.icon} {fieldTypeConfig[field.field_type]?.label}
              </Badge>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReorder(field.id, "up")}
                  disabled={index === 0}
                  className="h-7 w-7 p-0"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReorder(field.id, "down")}
                  disabled={index === fields.length - 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedFieldId(field.id)}
                  className="h-7 w-7 p-0"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFieldToDelete(field.id)
                    setDeleteDialogOpen(true)
                  }}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {expandedFieldId === field.id && (
              <div className="border-t p-4">
                <FieldEditor
                  field={field}
                  locationId={locationId}
                  onSave={(updates) => handleSaveField(field.id, updates)}
                  onCancel={() => setExpandedFieldId(null)}
                  saving={savingFieldId === field.id}
                />
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          className="flex h-20 w-full items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50 hover:bg-muted"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="mr-2 h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Add Field</span>
        </button>
      </div>

      <AddFieldDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        locationId={locationId}
        formId={template.id}
        nextSortOrder={fields.length}
        onFieldAdded={handleFieldAdded}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this field? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => fieldToDelete && handleDeleteField(fieldToDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
