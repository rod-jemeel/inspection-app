import type { Metadata } from "next"
import { SummitBrand } from "@/components/summit-brand"
import { InviteForm } from "./_components/invite-form"

export const metadata: Metadata = {
  title: "Enter Invite Code",
  description: "Enter your Summit invite code to access inspections.",
}

export default function InvitePage() {
  return (
    <div className="space-y-8">
      <SummitBrand
        size="lg"
        priority
        className="justify-center sm:justify-start"
        contentClassName="text-center sm:text-left"
      />
      <InviteForm />
    </div>
  )
}
