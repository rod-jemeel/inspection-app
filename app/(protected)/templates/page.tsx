import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { listTemplates } from "@/lib/server/services/templates"
import { listBinders } from "@/lib/server/services/binders"
import { listFormTemplates } from "@/lib/server/services/form-templates"
import { LoadingSpinner } from "@/components/loading-spinner"
import { TemplateList } from "./_components/template-list"

export const metadata: Metadata = {
  title: "Templates - Inspection Tracker",
}

async function TemplatesData({ loc, binder }: { loc: string; binder?: string }) {
  const { profile } = await requireLocationAccess(loc)
  const templates = await listTemplates(loc, { binderId: binder })
  const canManage = profile.role === "admin" || profile.role === "owner"

  // Fetch form templates from all binders for the "Linked Form" dropdown
  const binders = await listBinders(loc)
  const binderOptions = binders.map((b: any) => ({ id: b.id, name: b.name }))

  const allFormTemplates: { id: string; name: string; binder_id: string; binder_name: string }[] = []
  for (const b of binders) {
    const forms = await listFormTemplates(loc, b.id, { active: true })
    for (const form of forms) {
      allFormTemplates.push({
        id: form.id,
        name: form.name,
        binder_id: b.id,
        binder_name: b.name,
      })
    }
  }

  return (
    <TemplateList
      templates={templates}
      locationId={loc}
      canManage={canManage}
      formTemplates={allFormTemplates}
      binders={binderOptions}
      activeBinder={binder}
    />
  )
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; binder?: string }>
}) {
  const { loc, binder } = await searchParams
  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view templates</p>
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
      <TemplatesData loc={loc} binder={binder} />
    </Suspense>
  )
}
