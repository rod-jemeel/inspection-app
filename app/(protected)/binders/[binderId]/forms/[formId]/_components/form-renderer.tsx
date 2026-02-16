"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronDown, ChevronRight, Send, CheckCircle, AlertCircle, Loader2, PenLine, Camera, Eye, Pencil } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { FieldInput, type FormField } from "./field-input"
import { FullscreenSignaturePad } from "@/components/fullscreen-signature-pad"

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

interface ExistingFieldResponse {
  form_field_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: Record<string, unknown> | null
  attachment_url: string | null
  pass: boolean | null
}

interface ExistingResponse {
  id: string
  status: "draft" | "complete" | "flagged"
  remarks: string | null
  completion_signature: string | null
  completion_selfie: string | null
  field_responses: ExistingFieldResponse[]
}

interface FormRendererProps {
  binder: Binder
  template: FormTemplate
  fields: FormField[]
  locationId: string
  profileId: string
  profileName: string
  inspectionInstanceId?: string | null
  instanceDueDate?: string | null
  canEdit?: boolean
  existingResponse?: ExistingResponse
}

type FieldValues = Record<string, unknown>
type FieldErrors = Record<string, string>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFieldResponse(field: FormField, value: unknown, sectionCollapsed?: boolean) {
  const base: Record<string, unknown> = { form_field_id: field.id }

  // For fields in a collapsed section, send null values
  if (sectionCollapsed) {
    switch (field.field_type) {
      case "boolean":
        base.value_boolean = null
        break
      case "number":
      case "temperature":
      case "pressure":
        base.value_number = null
        break
      case "date":
        base.value_date = null
        break
      case "datetime":
        base.value_datetime = null
        break
      default:
        base.value_text = null
    }
    return base
  }

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

function validateField(field: FormField, value: unknown, sectionCollapsed?: boolean): string | null {
  // Section headers have no value to validate
  if (field.field_type === "section_header") return null
  // Skip validation for collapsed sections
  if (sectionCollapsed) return null

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

function getInitialValues(fields: FormField[], profileName?: string, instanceDueDate?: string | null): FieldValues {
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

  // Patterns for date fields that should auto-fill with instance date
  const datePatterns = [
    /date/i, /inspection.*date/i, /date.*inspection/i,
  ]

  // Patterns for time/datetime fields that should auto-fill with current time
  const timePatterns = [
    /time/i, /inspection.*time/i, /time.*inspection/i,
  ]

  // Pre-compute auto-fill values
  const dueDateStr = instanceDueDate
    ? new Date(instanceDueDate).toISOString().split("T")[0] // yyyy-MM-dd
    : null
  // Use local time for time auto-fill (not UTC)
  const now = new Date()
  const nowTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

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
    } else if (
      instanceDueDate &&
      field.field_type === "date" &&
      datePatterns.some((p) => p.test(field.label))
    ) {
      // Auto-fill date fields with the instance due date
      values[field.id] = dueDateStr
    } else if (
      instanceDueDate &&
      field.field_type === "datetime" &&
      timePatterns.some((p) => p.test(field.label))
    ) {
      // Auto-fill datetime "time" fields with instance date + current time
      values[field.id] = `${dueDateStr}T${nowTimeStr}`
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

function getValuesFromResponse(fields: FormField[], response: ExistingResponse): FieldValues {
  const values: FieldValues = {}
  const responseMap = new Map(response.field_responses.map((fr) => [fr.form_field_id, fr]))

  for (const field of fields) {
    const fr = responseMap.get(field.id)
    if (!fr) {
      values[field.id] = field.field_type === "multi_select" ? [] : null
      continue
    }

    switch (field.field_type) {
      case "boolean":
        values[field.id] = fr.value_boolean
        break
      case "number":
      case "temperature":
      case "pressure":
        values[field.id] = fr.value_number
        break
      case "date":
        values[field.id] = fr.value_date
        break
      case "datetime":
        values[field.id] = fr.value_datetime
        break
      case "multi_select":
        values[field.id] = fr.value_json ? (fr.value_json as { selected?: string[] }).selected ?? [] : []
        break
      case "signature":
      case "photo":
        values[field.id] = fr.attachment_url
        break
      default:
        values[field.id] = fr.value_text
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
  instanceDueDate,
  canEdit,
  existingResponse,
}: FormRendererProps) {
  const router = useRouter()
  const isEditMode = !!existingResponse
  const isPreviewMode = !inspectionInstanceId && !isEditMode

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.sort_order - b.sort_order),
    [fields]
  )

  // Build a map of field ID → section header ID (for section toggle)
  // Fields after a section_header belong to that section until the next
  // section_header or the first required field of a different type (e.g.
  // Inspector Name at the end is required text — not part of the weekly section).
  const sectionMap = useMemo(() => {
    const map: Record<string, string> = {} // fieldId → sectionHeaderId
    let currentSectionId: string | null = null
    for (const f of sortedFields) {
      if (f.field_type === "section_header") {
        currentSectionId = f.id
      } else if (currentSectionId) {
        // End the section when we hit a required field that isn't the same
        // type as the section's fields (boolean). This prevents trailing
        // fields like "Inspector Name" from being swallowed by the section.
        if (f.required) {
          currentSectionId = null
        } else {
          map[f.id] = currentSectionId
        }
      }
    }
    return map
  }, [sortedFields])

  // Track which sections are expanded (default: all collapsed)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set())

  const isSectionCollapsed = useCallback(
    (fieldId: string) => {
      const sectionId = sectionMap[fieldId]
      if (!sectionId) return false // not in any section
      return !expandedSections.has(sectionId)
    },
    [sectionMap, expandedSections]
  )

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }, [])

  const [values, setValues] = useState<FieldValues>(() =>
    existingResponse
      ? getValuesFromResponse(sortedFields, existingResponse)
      : getInitialValues(sortedFields, profileName, instanceDueDate)
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [remarks, setRemarks] = useState(existingResponse?.remarks ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(existingResponse?.completion_selfie ?? null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(existingResponse?.completion_signature ?? null)
  const [showSignaturePad, setShowSignaturePad] = useState(false)

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

  const handleSignatureSave = useCallback(
    async (data: { imageBlob: Blob; points: unknown; signerName: string }) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string)
        setShowSignaturePad(false)
      }
      reader.readAsDataURL(data.imageBlob)
    },
    []
  )

  const handleSubmit = useCallback(async () => {
    // Validate all fields (skip collapsed sections)
    const newErrors: FieldErrors = {}
    for (const field of sortedFields) {
      const collapsed = isSectionCollapsed(field.id)
      const error = validateField(field, values[field.id], collapsed)
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

    // Require completion signature or selfie
    if (!signaturePreview && !selfiePreview) {
      setSubmitError("Please provide a signature or selfie to complete the form")
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const fieldResponses = sortedFields
        .filter((field) => field.field_type !== "section_header")
        .map((field) => {
          const collapsed = isSectionCollapsed(field.id)
          return buildFieldResponse(field, values[field.id], collapsed)
        })

      let res: Response

      if (isEditMode && existingResponse) {
        // PATCH existing response — only send signature/selfie if changed
        // (new base64 data URL means re-signed; existing /api/files/ URL means unchanged)
        const sigChanged = signaturePreview?.startsWith("data:") ? signaturePreview : undefined
        const selfieChanged = selfiePreview?.startsWith("data:") ? selfiePreview : undefined

        const body = {
          status: "complete" as const,
          remarks: remarks.trim() || undefined,
          field_responses: fieldResponses,
          ...(sigChanged !== undefined && { completion_signature: sigChanged }),
          ...(selfieChanged !== undefined && { completion_selfie: selfieChanged }),
        }

        res = await fetch(
          `/api/locations/${locationId}/responses/${existingResponse.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        )
      } else {
        // POST new response
        const body = {
          form_template_id: template.id,
          status: "complete" as const,
          remarks: remarks.trim() || undefined,
          field_responses: fieldResponses,
          inspection_instance_id: inspectionInstanceId || undefined,
          completion_signature: signaturePreview,
          completion_selfie: selfiePreview,
        }

        res = await fetch(
          `/api/locations/${locationId}/forms/${template.id}/responses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        )
      }

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
  }, [sortedFields, values, remarks, template.id, locationId, signaturePreview, selfiePreview, isEditMode, existingResponse, inspectionInstanceId, isSectionCollapsed])

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
              <h2 className="text-sm font-medium">
                {isEditMode ? "Response updated" : "Response submitted"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Your response to{" "}
                <span className="font-medium text-foreground">{template.name}</span>{" "}
                has been {isEditMode ? "updated" : "recorded"}.
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
                  setValues(getInitialValues(sortedFields, profileName, instanceDueDate))
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
  const activeFields = sortedFields.filter(
    (f) => f.field_type !== "section_header" && !isSectionCollapsed(f.id)
  )
  const requiredCount = activeFields.filter((f) => f.required).length
  const filledRequiredCount = activeFields.filter((f) => {
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
                {activeFields.length} {activeFields.length === 1 ? "field" : "fields"}
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
        {sortedFields.map((field) => {
          // Section header: render as toggle card
          if (field.field_type === "section_header") {
            const isExpanded = expandedSections.has(field.id)
            return (
              <div
                key={field.id}
                className="rounded-md border border-indigo-200 bg-indigo-50/50 px-5 py-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-indigo-600" />
                    ) : (
                      <ChevronRight className="size-4 text-indigo-600" />
                    )}
                    <span className="text-xs font-semibold text-indigo-700">
                      {field.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {field.help_text && !isExpanded && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {field.help_text}
                      </span>
                    )}
                    <Switch
                      checked={isExpanded}
                      onCheckedChange={() => toggleSection(field.id)}
                      aria-label={`Toggle ${field.label}`}
                    />
                  </div>
                </div>
                {isExpanded && field.help_text && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed pl-6">
                    {field.help_text}
                  </p>
                )}
              </div>
            )
          }

          // Regular field: hide if in a collapsed section
          if (isSectionCollapsed(field.id)) return null

          return (
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
          )
        })}

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
        {/* Completion: Signature/Selfie (fill mode only)                    */}
        {/* ---------------------------------------------------------------- */}
        {!isPreviewMode && (
        <div className="rounded-md border bg-card px-5 py-4 shadow-sm">
          <div className="space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Completion
            </h3>

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
                  onClick={() => setShowSignaturePad(true)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-4 text-xs text-muted-foreground transition-colors hover:bg-muted/50",
                    signaturePreview && "border-solid border-primary/50"
                  )}
                >
                  {signaturePreview ? (
                    <img
                      src={signaturePreview}
                      alt="Signature"
                      className="h-12 w-32 object-contain"
                    />
                  ) : (
                    <PenLine className="size-5" />
                  )}
                  <span>{signaturePreview ? "Re-sign" : "Tap to sign"}</span>
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
                {isEditMode ? "Updating..." : "Submitting..."}
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                {isEditMode ? "Update" : "Submit"}
              </>
            )}
          </Button>
          )}
        </div>
      </div>

      {/* Fullscreen signature pad overlay */}
      {showSignaturePad && (
        <FullscreenSignaturePad
          title="Sign Form"
          description="Enter your name and sign to confirm your form submission."
          onSave={handleSignatureSave}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}
    </div>
  )
}
