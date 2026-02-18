import { Suspense } from "react"
import type { Metadata } from "next"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { getLogEntryByKey, listLogEntries } from "@/lib/server/services/log-entries"
import { LoadingSpinner } from "@/components/loading-spinner"
import { DrugSelector } from "./_components/drug-selector"
import { InventoryLedger } from "./_components/inventory-ledger"
import type { InventoryLogData } from "@/lib/validations/log-entry"
import { PRESET_DRUGS } from "@/lib/validations/log-entry"

export const metadata: Metadata = {
  title: "Controlled Substances Inventory - Inspection Tracker",
}

async function InventoryLoader({
  loc,
  drug,
}: {
  loc: string
  drug: string
}) {
  const { profile } = await requireLocationAccess(loc)

  const entry = await getLogEntryByKey(loc, "controlled_substance_inventory", drug)

  const preset = PRESET_DRUGS.find((d) => d.slug === drug)

  const initialEntry = entry
    ? {
        id: entry.id,
        data: entry.data as unknown as InventoryLogData,
        status: entry.status,
        submitted_by_name: entry.submitted_by_name ?? null,
      }
    : null

  const isAdmin = profile.role === "admin" || profile.role === "owner"

  return (
    <InventoryLedger
      locationId={loc}
      drugSlug={drug}
      drugLabel={preset?.drug_name ?? drug}
      presetDrug={preset ?? undefined}
      initialEntry={initialEntry}
      isAdmin={isAdmin}
    />
  )
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; drug?: string }>
}) {
  const { loc, drug } = await searchParams

  if (!loc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a location to view inventory</p>
      </div>
    )
  }

  if (!drug) {
    const { profile } = await requireLocationAccess(loc)
    const isAdmin = profile.role === "admin" || profile.role === "owner"

    // Fetch ALL existing inventory entries (presets + custom drugs)
    const { entries: allEntries } = await listLogEntries(loc, {
      log_type: "controlled_substance_inventory",
      limit: 100,
      offset: 0,
    })

    const stockInfo: Record<string, { id: string; currentStock: number | null; rowCount: number; lastDate: string | null; drugName: string; strength: string; sizeQty: string; status: "draft" | "complete" }> = {}

    for (const entry of allEntries) {
      const d = entry.data as unknown as InventoryLogData
      const rows = d.rows ?? []
      const nonEmptyRows = rows.filter((r: { date: string }) => r.date?.trim())
      const lastRow = nonEmptyRows[nonEmptyRows.length - 1]
      stockInfo[entry.log_key] = {
        id: entry.id,
        currentStock: lastRow?.qty_in_stock ?? null,
        rowCount: nonEmptyRows.length,
        lastDate: nonEmptyRows.length > 0 ? nonEmptyRows[nonEmptyRows.length - 1].date : null,
        drugName: d.drug_name || entry.log_key,
        strength: d.strength,
        sizeQty: d.size_qty,
        status: entry.status as "draft" | "complete",
      }
    }

    return <DrugSelector locationId={loc} stockInfo={stockInfo} isAdmin={isAdmin} />
  }

  return (
    <Suspense
      key={`${loc}-${drug}`}
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <InventoryLoader loc={loc} drug={drug} />
    </Suspense>
  )
}
