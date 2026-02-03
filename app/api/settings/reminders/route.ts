import "server-only"
import { NextRequest } from "next/server"
import { requireSession } from "@/lib/server/auth-helpers"
import { ApiError, handleError, validationError } from "@/lib/server/errors"
import {
  getReminderSettings,
  updateReminderSettings,
} from "@/lib/server/services/reminder-settings"
import { updateReminderSettingsSchema } from "@/lib/validations/reminder-settings"

async function requireOwnerRole() {
  const { profile } = await requireSession()

  if (profile.role !== "owner") {
    throw new ApiError("FORBIDDEN", "Owner role required")
  }

  return { profile }
}

export async function GET() {
  try {
    await requireOwnerRole()
    const settings = await getReminderSettings()
    return Response.json({ data: settings })
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { profile } = await requireOwnerRole()

    const body = await request.json()
    const result = updateReminderSettingsSchema.safeParse(body)

    if (!result.success) {
      return validationError(result.error.issues).toResponse()
    }

    const settings = await updateReminderSettings({
      userId: profile.id,
      input: result.data,
    })

    return Response.json({ data: settings })
  } catch (error) {
    return handleError(error)
  }
}
