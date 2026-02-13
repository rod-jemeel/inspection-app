import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getFormTemplate } from "@/lib/server/services/form-templates"
import { listFormFields } from "@/lib/server/services/form-fields"
import { getBinder, canUserEditBinder } from "@/lib/server/services/binders"
import { getInstance } from "@/lib/server/services/instances"
import { getFormResponse } from "@/lib/server/services/form-responses"
import { FormRenderer } from "./_components/form-renderer"

export const metadata: Metadata = {
  title: "Fill Form - Inspection Tracker",
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
  const { profile } = await requireLocationAccess(loc)
  const binder = await getBinder(loc, binderId)
  const template = await getFormTemplate(loc, formId)
  const fields = await listFormFields(formId, { active: true })
  const canEdit = await canUserEditBinder(profile.id, binderId, profile.role)

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
  if (responseId) {
    try {
      const raw = await getFormResponse(loc, responseId)
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
    } catch {
      // Response not found - continue in create mode
    }
  }

  return (
    <FormRenderer
      binder={binder}
      template={template}
      fields={fields}
      locationId={loc}
      profileId={profile.id}
      profileName={profile.full_name}
      inspectionInstanceId={instanceId ?? existingResponse?.inspection_instance_id ?? undefined}
      instanceDueDate={instanceDueDate}
      canEdit={canEdit}
      existingResponse={existingResponse}
    />
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
          <div className="mx-auto h-6 w-6 animate-spin rounded-none border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <FormData loc={loc} binderId={binderId} formId={formId} instanceId={instanceId} responseId={responseId} />
    </Suspense>
  )
}
