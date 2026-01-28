import "server-only"
import { Resend } from "resend"

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY not set - emails will be skipped")
}

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export const FROM_EMAIL =
  process.env.FROM_EMAIL || "Inspection Tracker <notifications@example.com>"
