import "server-only"
import { z } from "zod"

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),

  // Storage
  SIGNATURES_BUCKET: z.string().default("signatures"),

  // Email (optional in dev)
  RESEND_API_KEY: z.string().optional(),
  OWNER_ESCALATION_EMAIL: z.string().email().optional(),

  // Cron
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),

  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),

  // Push notifications (optional)
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")

    throw new Error(`Environment validation failed:\n${errors}`)
  }

  return result.data
}

// Validate and export typed environment variables
export const env = validateEnv()
