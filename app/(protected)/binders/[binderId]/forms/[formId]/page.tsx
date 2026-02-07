import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getFormTemplate } from "@/lib/server/services/form-templates"
import { listFormFields } from "@/lib/server/services/form-fields"
import { getBinder } from "@/lib/server/services/binders"
import { FormRenderer } from "./_components/form-renderer"

export const metadata: Metadata = {
  title: "Fill Form - Inspection Tracker",
}

async function FormData({
  loc,
  binderId,
  formId,
  instanceId,
}: {
  loc: string
  binderId: string
  formId: string
  instanceId?: string
}) {
  const { profile } = await requireLocationAccess(loc)
  const binder = await getBinder(loc, binderId)
  const template = await getFormTemplate(loc, formId)
  const fields = await listFormFields(formId, { active: true })

  return (
    <FormRenderer
      binder={binder}
      template={template}
      fields={fields}
      locationId={loc}
      profileId={profile.id}
      profileName={profile.full_name}
      inspectionInstanceId={instanceId}
    />
  )
}

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ binderId: string; formId: string }>
  searchParams: Promise<{ loc?: string; instanceId?: string }>
}) {
  const { binderId, formId } = await params
  const { loc, instanceId } = await searchParams

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
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <FormData loc={loc} binderId={binderId} formId={formId} instanceId={instanceId} />
    </Suspense>
  )
}
