"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DangerZoneProps {
  locationId: string
  isActive: boolean
}

export function DangerZone({ locationId, isActive }: DangerZoneProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleToggleActive = async () => {
    setLoading(true)

    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !isActive }),
      })

      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-5 md:col-span-2 lg:col-span-3">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-destructive/10">
          <AlertTriangle className="size-4 text-destructive" />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-destructive">Danger Zone</h3>
          <p className="text-[11px] text-muted-foreground">Irreversible actions</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-destructive/20 bg-background p-4">
        <div>
          <div className="text-xs font-medium">
            {isActive ? "Deactivate Location" : "Reactivate Location"}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isActive
              ? "This will stop generating new inspections. Existing data will be preserved."
              : "This will resume generating inspections based on active templates."}
          </p>
        </div>
        {isActive ? (
          <Button variant="destructive" size="sm" onClick={handleToggleActive} disabled={loading}>
            {loading ? "..." : "Deactivate"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={loading}>
            {loading ? "..." : "Reactivate"}
          </Button>
        )}
      </div>
    </div>
  )
}
