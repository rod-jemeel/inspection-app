import type { Metadata } from "next"
import { InviteForm } from "./_components/invite-form"

export const metadata: Metadata = {
  title: "Enter Invite Code - Inspection Tracker",
  description: "Enter your invite code to access inspections",
}

export default function InvitePage() {
  return <InviteForm />
}
