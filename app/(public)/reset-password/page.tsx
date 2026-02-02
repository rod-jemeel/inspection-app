import type { Metadata } from "next"
import { Suspense } from "react"
import { ResetPasswordForm } from "./_components/reset-password-form"

export const metadata: Metadata = {
  title: "Set New Password - Inspection Tracker",
  description: "Set your new password",
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
