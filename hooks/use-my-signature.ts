"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface MySignatureProfile {
  name: string
  signature_image: string | null
  default_initials: string
}

// Module-level cache so every component shares the same fetched data
// within a page session. Cleared on page refresh.
let cachedProfile: MySignatureProfile | null = null

/**
 * Hook to fetch the logged-in user's signature profile (name, initials).
 *
 * Returns a lazy `fetchProfile()` that only hits the network once, then
 * caches the result for the rest of the page session.
 *
 * Usage:
 *   const { profile, fetchProfile, isPending } = useMySignature()
 *   // call fetchProfile() when user taps "sign" — instant if already cached
 */
export function useMySignature() {
  const [profile, setProfile] = useState<MySignatureProfile | null>(cachedProfile)
  const [isPending, setIsPending] = useState(false)
  const inflightRef = useRef<Promise<MySignatureProfile | null> | null>(null)

  const fetchProfile = useCallback(async (): Promise<MySignatureProfile | null> => {
    // Already cached
    if (cachedProfile) {
      setProfile(cachedProfile)
      return cachedProfile
    }

    // Deduplicate concurrent calls
    if (inflightRef.current) {
      return inflightRef.current
    }

    setIsPending(true)

    const promise = (async () => {
      try {
        const res = await fetch("/api/users/me/signature")
        if (!res.ok) return null

        const data = await res.json()
        const p: MySignatureProfile = {
          name: data.name || "",
          signature_image: data.signature_image ?? null,
          default_initials: data.default_initials || "",
        }
        cachedProfile = p
        setProfile(p)
        return p
      } catch {
        return null
      } finally {
        setIsPending(false)
        inflightRef.current = null
      }
    })()

    inflightRef.current = promise
    return promise
  }, [])

  // Eagerly fetch on mount so name is pre-populated before user taps "sign"
  useEffect(() => {
    if (!cachedProfile) fetchProfile()
  }, [fetchProfile])

  return { profile, fetchProfile, isPending } as const
}
