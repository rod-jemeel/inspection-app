import { NextRequest } from "next/server"
import { requireLocationAccess } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { upsertLogEntrySchema, filterLogEntriesSchema } from "@/lib/validations/log-entry"
import { upsertLogEntry, listLogEntries, getLogEntryByIdentity } from "@/lib/server/services/log-entries"
import { uploadFormImage } from "@/lib/server/services/form-responses"
import { appendLogEntryEvent } from "@/lib/server/services/log-entry-events"
import { diffLogEntryAudit } from "@/lib/server/services/log-entry-diff"

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isSignatureDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/")
}

function isSignatureLikeKey(key: string | null): boolean {
  if (!key) return false
  return /(^signature$|_signature$|^sig$|^sig\d+$|_sig\d*$)/i.test(key)
}

async function uploadSignatureDataUrlsDeep(params: {
  node: unknown
  profileId: string
  logType: string
  keyHint?: string | null
}): Promise<unknown> {
  const { node, profileId, logType, keyHint = null } = params

  if (isSignatureDataUrl(node) && isSignatureLikeKey(keyHint)) {
    return uploadFormImage(`log-${logType}`, profileId, node, "signature")
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = await uploadSignatureDataUrlsDeep({
        node: node[i],
        profileId,
        logType,
        keyHint: keyHint ?? null,
      })
    }
    return node
  }

  if (isRecord(node)) {
    for (const [key, value] of Object.entries(node)) {
      node[key] = await uploadSignatureDataUrlsDeep({
        node: value,
        profileId,
        logType,
        keyHint: key,
      })
    }
    return node
  }

  return node
}

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

    const data = parsed.data.data as Record<string, unknown>
    await uploadSignatureDataUrlsDeep({
      node: data,
      profileId: profile.id,
      logType: parsed.data.log_type,
    })

    const prior = await getLogEntryByIdentity(locationId, {
      log_type: parsed.data.log_type,
      log_key: parsed.data.log_key,
      log_date: parsed.data.log_date,
    })

    const entry = await upsertLogEntry(locationId, profile.id, {
      ...parsed.data,
      data,
    })

    const { changes, summary } = diffLogEntryAudit({
      logType: parsed.data.log_type,
      oldData: prior?.data ?? null,
      newData: entry.data as Record<string, unknown>,
      oldStatus: prior?.status ?? null,
      newStatus: entry.status,
    })

    if (changes.length > 0) {
      const event_type =
        !prior
          ? "created"
          : prior.status === "draft" && entry.status === "complete"
            ? "submitted_complete"
            : prior.status === "complete" && entry.status === "draft"
              ? "reverted_draft"
              : "updated"

      await appendLogEntryEvent({
        log_entry_id: entry.id,
        location_id: locationId,
        log_type: parsed.data.log_type,
        log_key: parsed.data.log_key ?? "",
        log_date: parsed.data.log_date,
        event_type,
        actor_profile_id: profile.id,
        payload: {
          changes,
          summary,
          meta: { source: "logs-api" },
        },
      })
    }

    return Response.json(entry, { status: 200 })
  } catch (error) {
    return handleError(error)
  }
}
