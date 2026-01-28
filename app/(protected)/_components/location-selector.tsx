"use client"

import { useQueryState } from "nuqs"
import { useEffect } from "react"

export function LocationSelector({ locations }: { locations: { id: string; name: string }[] }) {
  const [locationId, setLocationId] = useQueryState("loc")

  useEffect(() => {
    if (!locationId && locations.length > 0) {
      setLocationId(locations[0].id)
    }
  }, [locationId, locations, setLocationId])

  if (locations.length <= 1) {
    return (
      <div data-slot="location-selector" className="px-3 py-2 text-xs font-medium">
        {locations[0]?.name ?? "No location"}
      </div>
    )
  }

  return (
    <select
      data-slot="location-selector"
      value={locationId ?? ""}
      onChange={(e) => setLocationId(e.target.value)}
      className="h-8 w-full rounded-none border border-sidebar-border bg-sidebar px-2 text-xs focus:border-ring focus:outline-none"
    >
      {locations.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {loc.name}
        </option>
      ))}
    </select>
  )
}
