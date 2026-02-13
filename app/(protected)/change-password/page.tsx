import type { Metadata } from "next"
import { ChangePasswordForm } from "./_components/change-password-form"

export const metadata: Metadata = {
  title: "Change Password - Inspection Tracker",
  description: "Change your password",
}

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <ChangePasswordForm />
    </div>
  )
}
