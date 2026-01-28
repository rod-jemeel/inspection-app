export default function InspectionsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-28 animate-pulse rounded-none bg-muted" />
      <div className="flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 w-16 animate-pulse rounded-none bg-muted" />
        ))}
      </div>
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-none bg-muted" />
        ))}
      </div>
    </div>
  )
}
