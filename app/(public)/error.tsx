"use client"

import { Button } from "@/components/ui/button"

export default function PublicError({
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
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/login"}>
            Back to login
          </Button>
        </div>
      </div>
    </div>
  )
}
