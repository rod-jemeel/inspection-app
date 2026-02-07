"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, FolderOpen } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BinderCard } from "./binder-card"
import { BinderDialog } from "./binder-dialog"

interface Binder {
  id: string
  location_id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
  created_by_profile_id: string | null
  form_count?: number
}

interface BinderListProps {
  binders: Binder[]
  locationId: string
  canManage: boolean
  profileId: string
}

export function BinderList({
  binders,
  locationId,
  canManage,
}: BinderListProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  // Filter binders based on search
  const filteredBinders = useMemo(() => {
    if (!search) return binders
    const query = search.toLowerCase()
    return binders.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.description?.toLowerCase().includes(query)
    )
  }, [binders, search])

  const handleBinderClick = (binderId: string) => {
    router.push(`/binders/${binderId}?loc=${locationId}`)
  }

  const handleSuccess = () => {
    router.refresh()
  }

  const hasBinders = binders.length > 0
  const hasFilteredBinders = filteredBinders.length > 0

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search binders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        {canManage && (
          <Button size="sm" className="px-2 sm:px-3" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4 sm:size-3.5" />
            <span className="hidden sm:inline">New Binder</span>
          </Button>
        )}
      </div>

      {/* Binder Grid */}
      {!hasBinders ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="mb-3 size-12 opacity-20" />
          <p className="text-xs">No binders yet.</p>
          {canManage && (
            <p className="mt-1 text-xs">Create your first binder to get started.</p>
          )}
        </div>
      ) : !hasFilteredBinders ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Search className="mb-3 size-12 opacity-20" />
          <p className="text-xs">No binders match your search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBinders.map((binder) => (
            <BinderCard
              key={binder.id}
              binder={binder}
              locationId={locationId}
              onClick={() => handleBinderClick(binder.id)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <BinderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        binder={null}
        locationId={locationId}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
