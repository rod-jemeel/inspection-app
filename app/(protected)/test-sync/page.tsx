import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { supabase } from "@/lib/server/db"
import { PageBreadcrumbs } from "@/components/page-breadcrumbs"
import { TestSyncClient } from "./_components/test-sync-client"

export const metadata: Metadata = { title: "Test Form Sync" }

export default async function TestSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>
}) {
  const { loc } = await searchParams
  if (!loc) redirect("/binders")

  const { profile } = await requireLocationAccess(loc)
  if (profile.role !== "owner" && !profile.can_manage_forms) redirect("/dashboard")

  // Fetch all binders with their form templates
  const { data: binders } = await supabase
    .from("binders")
    .select("id, name, color, icon")
    .eq("location_id", loc)
    .eq("active", true)
    .order("sort_order", { ascending: true })

  const { data: templates } = await supabase
    .from("form_templates")
    .select("id, binder_id, name, frequency, google_sheet_id, google_sheet_tab")
    .eq("location_id", loc)
    .eq("active", true)
    .order("sort_order", { ascending: true })

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Test Form Sync" }]} />
      <TestSyncClient
        locationId={loc}
        binders={binders ?? []}
        templates={templates ?? []}
      />
    </>
  )
}
