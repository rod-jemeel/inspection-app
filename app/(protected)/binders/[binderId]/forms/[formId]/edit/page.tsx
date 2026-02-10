import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getFormTemplate } from "@/lib/server/services/form-templates"
import { listFormFields } from "@/lib/server/services/form-fields"
import { getBinder } from "@/lib/server/services/binders"
import { canUserEditBinder } from "@/lib/server/services/binders"
import { redirect } from "next/navigation"
import { FormBuilder } from "./_components/form-builder"

export const metadata: Metadata = {
  title: "Edit Form - Inspection Tracker",
}

async function FormBuilderData({
  loc,
  binderId,
  formId,
}: {
  loc: string
  binderId: string
  formId: string
}) {
  const { profile } = await requireLocationAccess(loc)
  const [binder, template, fields, canEdit] = await Promise.all([
    getBinder(loc, binderId),
    getFormTemplate(loc, formId),
    listFormFields(formId),
    canUserEditBinder(profile.id, binderId, profile.role),
  ])

  if (!canEdit) {
    redirect(`/binders/${binderId}?loc=${loc}`)
  }

  return (
    <FormBuilder
      binder={binder}
      template={template}
      fields={fields}
      locationId={loc}
    />
  )
}

export default async function EditFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ binderId: string; formId: string }>
  searchParams: Promise<{ loc?: string }>
}) {
  const { binderId, formId } = await params
  const { loc } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-xs">Select a location to edit this form</p>
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
      <FormBuilderData loc={loc} binderId={binderId} formId={formId} />
    </Suspense>
  )
}
