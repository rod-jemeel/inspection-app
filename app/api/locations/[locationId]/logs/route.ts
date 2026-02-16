import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { upsertLogEntrySchema, filterLogEntriesSchema } from "@/lib/validations/log-entry"
import { upsertLogEntry, listLogEntries } from "@/lib/server/services/log-entries"
import { uploadFormImage } from "@/lib/server/services/form-responses"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireLocationAccess(locationId)

    const url = new URL(request.url)
    const raw = Object.fromEntries(url.searchParams)
    const parsed = filterLogEntriesSchema.safeParse(raw)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const result = await listLogEntries(locationId, parsed.data)
    return Response.json(result)
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    const { profile } = await requireLocationAccess(locationId)

    const body = await request.json()
    const parsed = upsertLogEntrySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    // Upload any base64 signature images in the data before saving
    const data = parsed.data.data as Record<string, unknown>
    const sigFields = ["header_sig1", "header_sig2", "end_sig1", "end_sig2"]
    for (const field of sigFields) {
      const val = data[field]
      if (typeof val === "string" && val.startsWith("data:image/")) {
        data[field] = await uploadFormImage(
          `log-${parsed.data.log_type}`,
          profile.id,
          val,
          "signature"
        )
      }
    }

    // Upload row-level signatures
    const rows = data.rows as Array<Record<string, unknown>> | undefined
    if (rows) {
      for (const row of rows) {
        if (typeof row.sig1 === "string" && row.sig1.startsWith("data:image/")) {
          row.sig1 = await uploadFormImage(
            `log-${parsed.data.log_type}`,
            profile.id,
            row.sig1,
            "signature"
          )
        }
        if (typeof row.sig2 === "string" && row.sig2.startsWith("data:image/")) {
          row.sig2 = await uploadFormImage(
            `log-${parsed.data.log_type}`,
            profile.id,
            row.sig2,
            "signature"
          )
        }
      }
    }

    const entry = await upsertLogEntry(locationId, profile.id, {
      ...parsed.data,
      data,
    })
    return Response.json(entry, { status: 200 })
  } catch (error) {
    return handleError(error)
  }
}
