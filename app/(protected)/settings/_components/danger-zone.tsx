"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
    <section className="space-y-5">
      <div className="flex flex-col gap-4 border-t border-destructive/20 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {isActive ? "Deactivate Location" : "Reactivate Location"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isActive
              ? "This stops new inspections from being generated. Existing data remains intact."
              : "This resumes inspection generation based on active templates."}
          </p>
        </div>
        {isActive ? (
          <Button variant="destructive" size="sm" onClick={handleToggleActive} disabled={loading}>
            {loading ? "Working..." : "Deactivate"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={loading}>
            {loading ? "Working..." : "Reactivate"}
          </Button>
        )}
      </div>
    </section>
  )
}
