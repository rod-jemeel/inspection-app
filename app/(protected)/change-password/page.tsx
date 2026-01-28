import type { Metadata } from "next"
import { ChangePasswordForm } from "./_components/change-password-form"

export const metadata: Metadata = {
  title: "Change Password - Inspection Tracker",
  description: "Change your password",
}

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ChangePasswordForm />
    </div>
  )
}
