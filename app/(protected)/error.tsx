"use client"

import { Button } from "@/components/ui/button"

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium text-destructive">Something went wrong</p>
        <p className="text-xs text-muted-foreground">{error.message || "An unexpected error occurred"}</p>
        <Button variant="outline" size="sm" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
