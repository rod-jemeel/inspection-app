"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Send, CheckCircle, AlertCircle, Loader2, PenLine, Camera, Eye, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { FieldInput, type FormField } from "./field-input"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Binder {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  location_id: string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
  created_by_profile_id: string | null
  form_count?: number
}

interface FormTemplate {
  id: string
  binder_id: string
  location_id: string
  name: string
  description: string | null
  instructions: string | null
  frequency: string | null
  default_assignee_profile_id: string | null
  regulatory_reference: string | null
  retention_years: number | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
  created_by_profile_id: string | null
}

interface FormRendererProps {
  binder: Binder
  template: FormTemplate
  fields: FormField[]
  locationId: string
  profileId: string
  profileName: string
  inspectionInstanceId?: string | null
  canEdit?: boolean
}

type FieldValues = Record<string, unknown>
type FieldErrors = Record<string, string>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFieldResponse(field: FormField, value: unknown) {
  const base: Record<string, unknown> = { form_field_id: field.id }

  switch (field.field_type) {
    case "text":
    case "textarea":
    case "select":
      base.value_text = value !== undefined && value !== null && value !== "" ? String(value) : null
      break
    case "number":
    case "temperature":
    case "pressure":
      base.value_number = value !== null && value !== undefined ? Number(value) : null
      break
    case "boolean":
      base.value_boolean = typeof value === "boolean" ? value : null
      break
    case "date":
      base.value_date = value && String(value).length > 0 ? String(value) : null
      break
    case "datetime":
      base.value_datetime =
        value && String(value).length > 0
          ? new Date(String(value)).toISOString()
          : null
      break
    case "multi_select":
      base.value_json = Array.isArray(value) && value.length > 0 ? { selected: value } : null
      break
    case "signature":
    case "photo":
      base.attachment_url = value ? String(value) : null
      break
    default:
      base.value_text = value !== undefined && value !== null ? String(value) : null
  }

  return base
}

function validateField(field: FormField, value: unknown): string | null {
  // Required check
  if (field.required) {
    if (value === undefined || value === null || value === "") {
      return "This field is required"
    }
    if (field.field_type === "multi_select" && Array.isArray(value) && value.length === 0) {
      return "Select at least one option"
    }
  }

  // Number range checks
  if (
    (field.field_type === "number" ||
      field.field_type === "temperature" ||
      field.field_type === "pressure") &&
    value !== null &&
    value !== undefined &&
    value !== ""
  ) {
    const num = Number(value)
    if (isNaN(num)) return "Enter a valid number"

    const rules = field.validation_rules
    if (rules) {
      const min = rules.min !== undefined && rules.min !== null ? Number(rules.min) : null
      const max = rules.max !== undefined && rules.max !== null ? Number(rules.max) : null
      if (min !== null && num < min) return `Value must be at least ${min}`
      if (max !== null && num > max) return `Value must be at most ${max}`
    }
  }

  return null
}

function getInitialValues(fields: FormField[], profileName?: string): FieldValues {
  const values: FieldValues = {}
  const namePatterns = [
    /inspector.*name/i, /name.*inspector/i,
    /^name$/i, /^name\b/i,
    /checked by/i, /completed by/i, /performed by/i,
    /tester/i, /technician.*name/i, /staff.*name/i,
    /^initials$/i, /name.*initial/i,
    /recorder.*name/i, /facilitator.*name/i,
    /reviewer.*name/i, /surveyor/i,
    /rn.*signature/i, /co-signature/i, /witness/i,
    /team.*leader/i, /recording.*rn/i, /medication.*rn/i,
    /officer/i, /observer.*name/i,
  ]

  for (const field of fields) {
    if (field.default_value !== null && field.default_value !== undefined) {
      switch (field.field_type) {
        case "boolean":
          values[field.id] = field.default_value === "true"
          break
        case "number":
        case "temperature":
        case "pressure":
          values[field.id] = Number(field.default_value)
          break
        case "multi_select":
          try {
            values[field.id] = JSON.parse(field.default_value)
          } catch {
            values[field.id] = []
          }
          break
        default:
          values[field.id] = field.default_value
      }
    } else if (
      profileName &&
      field.field_type === "text" &&
      namePatterns.some((p) => p.test(field.label))
    ) {
      values[field.id] = profileName
    } else {
      switch (field.field_type) {
        case "multi_select":
          values[field.id] = []
          break
        case "boolean":
          values[field.id] = null
          break
        default:
          values[field.id] = null
      }
    }
  }
  return values
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormRenderer({
  binder,
  template,
  fields,
  locationId,
  profileId,
  profileName,
  inspectionInstanceId,
  canEdit,
}: FormRendererProps) {
  const router = useRouter()
  const isPreviewMode = !inspectionInstanceId

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.sort_order - b.sort_order),
    [fields]
  )

  const [values, setValues] = useState<FieldValues>(() => getInitialValues(sortedFields, profileName))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [remarks, setRemarks] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)

  const selfieInputRef = useRef<HTMLInputElement>(null)

  const binderColor = binder.color || "#6366f1"

  const handleFieldChange = useCallback((fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    setErrors((prev) => {
      if (!prev[fieldId]) return prev
      const next = { ...prev }
      delete next[fieldId]
      return next
    })
  }, [])

  const handleSelfieCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setSelfiePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSubmit = useCallback(async () => {
    // Validate all fields
    const newErrors: FieldErrors = {}
    for (const field of sortedFields) {
      const error = validateField(field, values[field.id])
      if (error) newErrors[field.id] = error
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      // Scroll to first error
      const firstErrorId = sortedFields.find((f) => newErrors[f.id])?.id
      if (firstErrorId) {
        const el = document.getElementById(`field-${firstErrorId}`)
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const fieldResponses = sortedFields.map((field) =>
        buildFieldResponse(field, values[field.id])
      )

      const body = {
        form_template_id: template.id,
        status: "complete" as const,
        remarks: remarks.trim() || undefined,
        field_responses: fieldResponses,
        inspection_instance_id: inspectionInstanceId || undefined,
      }

      const res = await fetch(
        `/api/locations/${locationId}/forms/${template.id}/responses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        const serverMsg = data?.error?.message || data?.message || ""
        if (res.status === 400 && serverMsg) {
          throw new Error(`Please check your entries and try again. (${serverMsg})`)
        }
        throw new Error(serverMsg || `Submission failed (${res.status})`)
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }, [sortedFields, values, remarks, template.id, locationId])

  const handleBackToBinder = useCallback(() => {
    router.push(`/binders/${binder.id}?loc=${locationId}`)
  }, [router, binder.id, locationId])

  // ----- Success state -----
  if (submitted) {
    return (
      <div className="min-h-[60vh] px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col items-center gap-4 rounded-md border bg-card px-6 py-12 text-center shadow-sm">
            <div
              className="flex size-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${binderColor}15` }}
            >
              <CheckCircle className="size-6" style={{ color: binderColor }} />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-medium">Response submitted</h2>
              <p className="text-xs text-muted-foreground">
                Your response to{" "}
                <span className="font-medium text-foreground">{template.name}</span>{" "}
                has been recorded.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleBackToBinder}>
                <ChevronLeft className="size-3.5" />
                Back to binder
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSubmitted(false)
                  setValues(getInitialValues(sortedFields, profileName))
                  setRemarks("")
                  setErrors({})
                  setSubmitError(null)
                  setSelfiePreview(null)
                }}
              >
                Submit another
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ----- Form state -----
  const requiredCount = sortedFields.filter((f) => f.required).length
  const filledRequiredCount = sortedFields.filter((f) => {
    if (!f.required) return false
    const v = values[f.id]
    if (v === null || v === undefined || v === "") return false
    if (f.field_type === "multi_select" && Array.isArray(v) && v.length === 0) return false
    return true
  }).length

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* ---------------------------------------------------------------- */}
        {/* Header card                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="overflow-hidden rounded-md border bg-card shadow-sm">
          {/* Colored top accent */}
          <div className="h-1.5" style={{ backgroundColor: binderColor }} />

          <div className="space-y-2 px-5 py-4">
            {/* Breadcrumb back to binder */}
            <button
              type="button"
              onClick={handleBackToBinder}
              className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
              <span>{binder.name}</span>
            </button>

            {/* Form title */}
            <h1 className="text-sm font-medium leading-snug">{template.name}</h1>

            {/* Description */}
            {template.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {template.description}
              </p>
            )}

            {/* Instructions */}
            {template.instructions && (
              <div className="rounded-md bg-muted/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {template.instructions}
                </p>
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
              <span>
                {sortedFields.length} {sortedFields.length === 1 ? "field" : "fields"}
              </span>
              {!isPreviewMode && requiredCount > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span>
                    {filledRequiredCount}/{requiredCount} required filled
                  </span>
                </>
              )}
              <span className="ml-auto truncate">{profileName}</span>
            </div>

            {/* Preview mode banner */}
            {isPreviewMode && (
              <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2">
                <Eye className="size-3.5 shrink-0 text-muted-foreground" />
                <p className="flex-1 text-[11px] text-muted-foreground">
                  Preview only. To fill this form, start from an inspection instance.
                </p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 text-[11px] shrink-0"
                    onClick={() => router.push(`/binders/${binder.id}/forms/${template.id}/edit?loc=${locationId}`)}
                  >
                    <Pencil className="size-3" />
                    Edit Fields
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Field cards                                                      */}
        {/* ---------------------------------------------------------------- */}
        {sortedFields.map((field, index) => (
          <div
            key={field.id}
            id={`field-${field.id}`}
            className={cn(
              "rounded-md border bg-card px-5 py-4 shadow-sm transition-shadow",
              errors[field.id] && "border-destructive/50 shadow-destructive/5"
            )}
          >
            <div className="space-y-2.5">
              {/* Label row */}
              <div className="flex items-start gap-1">
                <label className="text-xs font-medium leading-snug">
                  {field.label}
                  {field.required && (
                    <span className="ml-0.5 text-destructive" aria-label="required">
                      *
                    </span>
                  )}
                </label>
              </div>

              {/* Help text */}
              {field.help_text && (
                <p className="text-[11px] text-muted-foreground leading-relaxed -mt-1">
                  {field.help_text}
                </p>
              )}

              {/* Input */}
              <FieldInput
                field={field}
                value={values[field.id]}
                onChange={(v) => handleFieldChange(field.id, v)}
                error={errors[field.id]}
                disabled={isPreviewMode}
              />

              {/* Error */}
              {errors[field.id] && (
                <p
                  role="alert"
                  data-slot="field-error"
                  className="flex items-center gap-1.5 text-xs text-destructive"
                >
                  <AlertCircle className="size-3 shrink-0" />
                  {errors[field.id]}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* ---------------------------------------------------------------- */}
        {/* Remarks card (fill mode only)                                    */}
        {/* ---------------------------------------------------------------- */}
        {!isPreviewMode && (
        <div className="rounded-md border bg-card px-5 py-4 shadow-sm">
          <div className="space-y-2.5">
            <label className="text-xs font-medium leading-snug">
              Additional remarks
            </label>
            <Textarea
              placeholder="Optional notes, observations, or corrective actions..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Completion: Name + Signature/Selfie (fill mode only)             */}
        {/* ---------------------------------------------------------------- */}
        {!isPreviewMode && (
        <div className="rounded-md border bg-card px-5 py-4 shadow-sm">
          <div className="space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Completion
            </h3>

            {/* Pre-filled name (read-only) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Your Name</label>
              <div className="flex h-8 items-center rounded-md border bg-muted/30 px-3 text-xs">
                {profileName}
              </div>
            </div>

            {/* Signature & Selfie */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Signature or Selfie
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Signature option */}
                <button
                  type="button"
                  className="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-4 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                >
                  <PenLine className="size-5" />
                  <span>Tap to sign</span>
                </button>

                {/* Selfie option */}
                <button
                  type="button"
                  onClick={() => selfieInputRef.current?.click()}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-4 text-xs text-muted-foreground transition-colors hover:bg-muted/50",
                    selfiePreview && "border-solid border-primary/50"
                  )}
                >
                  {selfiePreview ? (
                    <img
                      src={selfiePreview}
                      alt="Selfie"
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <Camera className="size-5" />
                  )}
                  <span>{selfiePreview ? "Retake" : "Take selfie"}</span>
                </button>
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handleSelfieCapture}
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Submit error banner                                              */}
        {/* ---------------------------------------------------------------- */}
        {!isPreviewMode && submitError && (
          <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-destructive">Submission failed</p>
              <p className="text-[11px] text-destructive/80">{submitError}</p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Footer buttons                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToBinder}
            disabled={submitting}
          >
            <ChevronLeft className="size-3.5" />
            {isPreviewMode ? "Back to binder" : "Cancel"}
          </Button>

          {!isPreviewMode && (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="min-w-[120px]"
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                Submit
              </>
            )}
          </Button>
          )}
        </div>
      </div>
    </div>
  )
}
