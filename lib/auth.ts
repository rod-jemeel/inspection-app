import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { username } from "better-auth/plugins"
import { Pool } from "pg"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // Skip if user has no email
      if (!user.email) {
        console.warn("User has no email, password reset email not sent")
        return
      }

      // Dynamic import to avoid circular dependencies
      const { resend, FROM_EMAIL } = await import("@/lib/server/email")
      const { PasswordResetEmail } = await import("@/emails/password-reset-email")

      if (!resend) {
        console.warn("Resend not configured, password reset email not sent")
        return
      }

      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: "Reset your password",
        react: PasswordResetEmail({
          fullName: user.name,
          resetUrl: url,
        }),
      })
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [APP_URL],
  plugins: [
    nextCookies(),
    username(), // Enable username-based authentication
  ],
})

export type Session = typeof auth.$Infer.Session
