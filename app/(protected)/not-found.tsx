import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ProtectedNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="space-y-3 text-center">
        <p className="text-4xl font-bold text-muted-foreground">404</p>
        <p className="text-sm font-medium">Page not found</p>
        <p className="text-xs text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
