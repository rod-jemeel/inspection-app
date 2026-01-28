import { redirect } from "next/navigation"
import { checkHasUsers } from "@/lib/server/utils/password"
import { SetupForm } from "./_components/setup-form"

export default async function SetupPage() {
  // Only allow access if no users exist
  const hasUsers = await checkHasUsers()
  if (hasUsers) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SetupForm />
    </div>
  )
}
