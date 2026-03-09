import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { checkHasUsers } from "@/lib/server/utils/password"
import { LoginForm } from "./_components/login-form"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Summit inspection tracker account.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>
}) {
  // Redirect to setup if no users exist
  const hasUsers = await checkHasUsers()
  if (!hasUsers) {
    redirect("/setup")
  }

  const { setup } = await searchParams
  const showSetupSuccess = setup === "success"

  return <LoginForm showSetupSuccess={showSetupSuccess} />
}
