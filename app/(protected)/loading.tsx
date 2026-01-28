export default function ProtectedLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-none border-2 border-muted border-t-primary" />
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
