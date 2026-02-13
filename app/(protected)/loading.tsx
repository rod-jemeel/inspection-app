import { LoadingSpinner } from "@/components/loading-spinner"

export default function ProtectedLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="space-y-3 text-center">
        <LoadingSpinner />
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
