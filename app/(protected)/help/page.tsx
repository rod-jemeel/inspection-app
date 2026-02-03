import { Suspense } from "react"
import { HelpContent } from "./_components/help-content"

export const metadata = {
  title: "Help & User Guide",
  description: "Learn how to use the Inspection App",
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-muted-foreground">Loading help...</div>}>
      <HelpContent />
    </Suspense>
  )
}
