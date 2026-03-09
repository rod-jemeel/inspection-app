import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SummitBrand } from "@/components/summit-brand"
import { checkHasUsers } from "@/lib/server/utils/password"
import { SetupForm } from "./_components/setup-form"

export const metadata: Metadata = {
  title: "Initial Setup",
  description: "Create the first Summit admin account and location.",
}

export default async function SetupPage() {
  // Only allow access if no users exist
  const hasUsers = await checkHasUsers()
  if (hasUsers) {
    redirect("/login")
  }

  return (
    <div className="space-y-8">
      <SummitBrand
        size="lg"
        priority
        className="justify-center sm:justify-start"
        contentClassName="text-center sm:text-left"
      />
      <SetupForm />
    </div>
  )
}
