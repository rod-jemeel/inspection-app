"use client"

import { useEffect } from "react"

/**
 * When a log page is opened directly with an instanceId, auto-transition
 * the instance from "pending" → "in_progress" so it shows as active.
 * Safe to call when already in_progress (server ignores no-op transitions).
 */
export function useStartInstance(locationId: string, instanceId: string | null | undefined) {
  useEffect(() => {
    if (!instanceId) return

    fetch(`/api/locations/${locationId}/instances/${instanceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    }).catch(() => {
      // Best-effort — don't block the log UI if this fails
    })
  }, [locationId, instanceId])
}
