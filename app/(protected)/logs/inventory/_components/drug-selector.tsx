"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pill, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LogPdfExportDialog } from "@/components/log-pdf-export-dialog"
import { PRESET_DRUGS } from "@/lib/validations/log-entry"
import { InventorySummary } from "./inventory-summary"

interface StockEntry {
  id: string
  currentStock: number | null
  rowCount: number
  firstDate: string | null
  lastDate: string | null
  rowDates?: string[]
  drugName: string
  strength: string
  sizeQty: string
  status: "draft" | "complete"
}

interface DrugSelectorProps {
  locationId: string
  stockInfo?: Record<string, StockEntry>
  isAdmin?: boolean
}

function parseInventoryDate(value: string | null): Date | null {
  if (!value) return null

  // Supports both `YYYY-MM-DD` and `MM/DD/YYYY` formats present in ledger rows.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [m, d, y] = value.split("/").map(Number)
    return new Date(y, m - 1, d)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatInventoryDate(value: string | null): string | null {
  const parsed = parseInventoryDate(value)
  if (!parsed) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed)
}

function formatInventoryMonth(value: string | null): string | null {
  const parsed = parseInventoryDate(value)
  if (!parsed) return null
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(parsed)
}

export function DrugSelector({ locationId, stockInfo, isAdmin }: DrugSelectorProps) {
  const router = useRouter()
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customStrength, setCustomStrength] = useState("")
  const [customSize, setCustomSize] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; name: string; id: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Derive custom drug slugs (entries that exist in DB but aren't in PRESET_DRUGS)
  const presetSlugs = new Set<string>(PRESET_DRUGS.map((d) => d.slug))
  const customDrugs = Object.entries(stockInfo ?? {})
    .filter(([slug]) => !presetSlugs.has(slug))
    .map(([slug, info]) => ({ slug, ...info }))

  function selectDrug(slug: string) {
    router.push(`/logs/inventory?loc=${locationId}&drug=${slug}`)
  }

  function handleAddCustom() {
    if (!customName.trim()) return
    const slug = customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
    selectDrug(slug)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/locations/${locationId}/logs/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error?.message ?? "Failed to delete")
        return
      }
      setDeleteTarget(null)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Tabs defaultValue="drugs" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Controlled Substances Inventory</h2>
          <p className="text-xs text-muted-foreground">
            Select a drug to view or edit its perpetual inventory ledger
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="drugs" className="text-xs">Drugs</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="drugs" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRESET_DRUGS.map((drug) => {
            const info = stockInfo?.[drug.slug]
            return (
              <Card
                key={drug.slug}
                className="group relative cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => selectDrug(drug.slug)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    selectDrug(drug.slug)
                  }
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Pill className="size-4 text-muted-foreground" aria-hidden="true" />
                    <CardTitle className="text-sm">{drug.drug_name}</CardTitle>
                    {info && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        ongoing
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {drug.strength} &middot; {drug.size_qty}
                  </p>
                  {info && (
                    <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {info.currentStock !== null && (
                          <span>
                            Stock: <span className="font-medium text-foreground">{info.currentStock}</span> units
                          </span>
                        )}
                        {info.rowCount > 0 && <span>{info.rowCount} entries</span>}
                      </div>
                      {info.lastDate && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] leading-tight text-muted-foreground/90">
                          <span>Active month: {formatInventoryMonth(info.lastDate)}</span>
                          <span>Last updated: {formatInventoryDate(info.lastDate)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                {isAdmin && info && (
                  <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <LogPdfExportDialog
                      locationId={locationId}
                      logType="controlled_substance_inventory"
                      rangeKind="date"
                      defaultDrugSlug={drug.slug}
                      defaultRange={{
                        dateFrom: info.firstDate ?? undefined,
                        dateTo: info.lastDate ?? undefined,
                      }}
                      availableDateRange={{
                        from: info.firstDate,
                        to: info.lastDate,
                      }}
                      availableDateValues={info.rowDates}
                      disabled={info.rowCount === 0}
                      stopPropagationOnTrigger
                      className="h-7 px-2"
                      triggerLabel="Export"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget({ slug: drug.slug, name: drug.drug_name, id: info.id })
                      }}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
                {!isAdmin && info && (
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100">
                    <LogPdfExportDialog
                      locationId={locationId}
                      logType="controlled_substance_inventory"
                      rangeKind="date"
                      defaultDrugSlug={drug.slug}
                      defaultRange={{
                        dateFrom: info.firstDate ?? undefined,
                        dateTo: info.lastDate ?? undefined,
                      }}
                      availableDateRange={{
                        from: info.firstDate,
                        to: info.lastDate,
                      }}
                      availableDateValues={info.rowDates}
                      disabled={info.rowCount === 0}
                      stopPropagationOnTrigger
                      className="h-7 px-2"
                      triggerLabel="Export"
                    />
                  </div>
                )}
              </Card>
            )
          })}

          {/* Custom drugs (from DB, not in presets) */}
          {customDrugs.map((drug) => (
            <Card
              key={drug.slug}
              className="group relative cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => selectDrug(drug.slug)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  selectDrug(drug.slug)
                }
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Pill className="size-4 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="text-sm">{drug.drugName}</CardTitle>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    ongoing
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {drug.strength || "No strength"} &middot; {drug.sizeQty || "No size"}
                </p>
                <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {drug.currentStock !== null && (
                      <span>
                        Stock: <span className="font-medium text-foreground">{drug.currentStock}</span> units
                      </span>
                    )}
                    {drug.rowCount > 0 && <span>{drug.rowCount} entries</span>}
                  </div>
                  {drug.lastDate && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] leading-tight text-muted-foreground/90">
                      <span>Active month: {formatInventoryMonth(drug.lastDate)}</span>
                      <span>Last updated: {formatInventoryDate(drug.lastDate)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <LogPdfExportDialog
                  locationId={locationId}
                  logType="controlled_substance_inventory"
                  rangeKind="date"
                  defaultDrugSlug={drug.slug}
                  defaultRange={{
                    dateFrom: drug.firstDate ?? undefined,
                    dateTo: drug.lastDate ?? undefined,
                  }}
                  availableDateRange={{
                    from: drug.firstDate,
                    to: drug.lastDate,
                  }}
                  availableDateValues={drug.rowDates}
                  disabled={drug.rowCount === 0}
                  stopPropagationOnTrigger
                  className="h-7 px-2"
                  triggerLabel="Export"
                />
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget({ slug: drug.slug, name: drug.drugName, id: drug.id })
                    }}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </Card>
          ))}

          {/* Add custom drug card */}
          <Card
            className="cursor-pointer border-dashed transition-colors hover:bg-muted/50"
            onClick={() => setShowCustom(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setShowCustom(true)
              }
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm">Add Custom Drug</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Create a new inventory ledger for a different controlled substance
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="summary">
        <InventorySummary locationId={locationId} />
      </TabsContent>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Inventory Ledger</DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently delete the <span className="font-semibold">{deleteTarget?.name}</span> ledger and all its transaction history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting\u2026" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCustom} onOpenChange={setShowCustom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Add Custom Drug</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Drug Name *</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g., Ketamine"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Strength</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g., 100mg/mL"
                value={customStrength}
                onChange={(e) => setCustomStrength(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Size / Quantity</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g., 10mL vials"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowCustom(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCustom} disabled={!customName.trim()}>
              Open Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
