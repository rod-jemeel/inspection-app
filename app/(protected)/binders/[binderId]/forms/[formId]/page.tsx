import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { canEditCompletedResponses, requireBinderAccess } from "@/lib/server/auth-helpers"
import { ApiError } from "@/lib/server/errors"
import { getFormTemplate } from "@/lib/server/services/form-templates"
import { listFormFields } from "@/lib/server/services/form-fields"
import { getBinder, canUserEditBinder } from "@/lib/server/services/binders"
import { getInstance } from "@/lib/server/services/instances"
import { getFormResponse } from "@/lib/server/services/form-responses"
import { LoadingSpinner } from "@/components/loading-spinner"
import { PageBreadcrumbs } from "@/components/page-breadcrumbs"
import { FormRenderer } from "./_components/form-renderer"

export const metadata: Metadata = {
  title: "Fill Form",
}

async function FormData({
  loc,
  binderId,
  formId,
  instanceId,
  responseId,
}: {
  loc: string
  binderId: string
  formId: string
  instanceId?: string
  responseId?: string
}) {
  const { profile } = await requireBinderAccess(loc, binderId)
  const [binder, liveTemplate, liveFields, canEdit] = await Promise.all([
    getBinder(loc, binderId),
    getFormTemplate(loc, formId),
    listFormFields(formId, { active: true }),
    canUserEditBinder(profile.id, binderId, profile.role, {
      can_manage_binders: profile.can_manage_binders,
      can_manage_forms: profile.can_manage_forms,
    }),
  ])

  if (liveTemplate.binder_id !== binderId) {
    throw new ApiError("NOT_FOUND", "Form template not found in this binder")
  }

  // Fetch instance due date for auto-populating date/time fields
  let instanceDueDate: string | undefined
  if (instanceId) {
    try {
      const instance = await getInstance(loc, instanceId)
      instanceDueDate = instance.due_at
    } catch {
      // Instance may not exist or be inaccessible - continue without it
    }
  }

  // Fetch existing response for edit mode
  let existingResponse: Awaited<ReturnType<typeof getFormResponse>> | undefined
  let canEditExistingResponse = false
  let template = liveTemplate
  let fields = liveFields
  if (responseId) {
    try {
      const raw = await getFormResponse(loc, responseId)
      if (raw.form_template_id !== formId) {
        notFound()
      }

      const canAccessResponse =
        profile.role === "owner" ||
        profile.can_view_all_responses ||
        raw.submitted_by_profile_id === profile.id

      if (!canAccessResponse) {
        throw new ApiError("FORBIDDEN", "You can only view permitted responses")
      }

      canEditExistingResponse =
        canEditCompletedResponses(profile) ||
        (raw.submitted_by_profile_id === profile.id && raw.status === "draft")

      // Convert storage paths to viewable URLs for the client
      existingResponse = {
        ...raw,
        completion_signature: raw.completion_signature
          ? `/api/files/${raw.id}?type=signature`
          : null,
        completion_selfie: raw.completion_selfie
          ? `/api/files/${raw.id}?type=selfie`
          : null,
      }

      template = {
        ...liveTemplate,
        name: raw.template_snapshot.name || liveTemplate.name,
        description: raw.template_snapshot.description ?? liveTemplate.description,
        instructions: raw.template_snapshot.instructions ?? liveTemplate.instructions,
        frequency: raw.template_snapshot.frequency ?? liveTemplate.frequency,
        regulatory_reference: raw.template_snapshot.regulatory_reference ?? liveTemplate.regulatory_reference,
        retention_years: raw.template_snapshot.retention_years ?? liveTemplate.retention_years,
      }
      fields = raw.template_snapshot.fields.length > 0
        ? raw.template_snapshot.fields.map((field) => ({
            ...field,
            created_at: liveFields.find((liveField) => liveField.id === field.id)?.created_at ?? raw.created_at,
            updated_at: liveFields.find((liveField) => liveField.id === field.id)?.updated_at ?? raw.updated_at,
          }))
        : liveFields
    } catch (error) {
      if (error instanceof ApiError && error.code === "NOT_FOUND") {
        notFound()
      }
      throw error
    }
  }

  return (
    <>
      <PageBreadcrumbs
        items={[
          { label: "Binders", href: `/binders?loc=${loc}` },
          { label: binder.name, href: `/binders/${binder.id}?loc=${loc}` },
          { label: template.name },
        ]}
      />
      <FormRenderer
        binder={binder}
        template={template}
        fields={fields}
        locationId={loc}
        profileName={profile.full_name}
        inspectionInstanceId={instanceId ?? existingResponse?.inspection_instance_id ?? undefined}
        instanceDueDate={instanceDueDate}
        canEdit={canEdit}
        existingResponse={existingResponse}
        canEditExistingResponse={canEditExistingResponse}
      />
    </>
  )
}

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ binderId: string; formId: string }>
  searchParams: Promise<{ loc?: string; instanceId?: string; responseId?: string }>
}) {
  const { binderId, formId } = await params
  const { loc, instanceId, responseId } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-xs">Select a location to fill this form</p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <FormData loc={loc} binderId={binderId} formId={formId} instanceId={instanceId} responseId={responseId} />
    </Suspense>
  )
}
