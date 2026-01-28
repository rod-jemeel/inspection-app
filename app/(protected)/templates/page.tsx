import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { listTemplates } from "@/lib/server/services/templates"
import { TemplateList } from "./_components/template-list"

export const metadata: Metadata = {
  title: "Templates - Inspection Tracker",
}

async function TemplatesData({ loc }: { loc: string }) {
  const { profile } = await requireLocationAccess(loc)
  const templates = await listTemplates(loc)
  const canManage = profile.role === "admin" || profile.role === "owner"

  return <TemplateList templates={templates} locationId={loc} canManage={canManage} />
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams
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
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <TemplatesData loc={loc} />
    </Suspense>
  )
}
