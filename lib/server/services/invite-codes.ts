import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"
import type { CreateInviteInput } from "@/lib/validations/invite"

export interface InviteCode {
  id: string
  code_hash: string
  expires_at: string
  max_uses: number
  uses: number
  role_grant: "owner" | "admin" | "nurse" | "inspector"
  location_id: string
  assigned_email: string | null
  created_by: string
  created_at: string
  consumed_at: string | null
}

export async function listInviteCodes(locationId: string) {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("id, code_hash, expires_at, max_uses, uses, role_grant, location_id, assigned_email, created_by, created_at, consumed_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as InviteCode[]
}

export async function createInviteCode(
  locationId: string,
  userId: string,
  input: CreateInviteInput
) {
  // Generate random 8-character code
  const code = generateCode(8)
  const codeHash = await hashCode(code)

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + input.expires_in_days)

  const { data, error } = await supabase
    .from("invite_codes")
    .insert({
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
      max_uses: input.max_uses,
      role_grant: "inspector",
      location_id: locationId,
      assigned_email: input.assigned_email,
      created_by: userId,
    })
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return { invite: data as InviteCode, code }
}

export async function exchangeInviteCode(plainCode: string) {
  const codeHash = await hashCode(plainCode)

  const { data: invite, error } = await supabase
    .from("invite_codes")
    .select("id, code_hash, expires_at, max_uses, uses, role_grant, location_id, assigned_email, created_by, created_at, consumed_at")
    .eq("code_hash", codeHash)
    .single()

  if (error || !invite) {
    throw new ApiError("INVALID_CODE", "Invalid invite code")
  }

  const record = invite as InviteCode

  if (new Date(record.expires_at) < new Date()) {
    throw new ApiError("EXPIRED_CODE", "Invite code has expired")
  }

  if (record.uses >= record.max_uses) {
    throw new ApiError("CODE_EXHAUSTED", "Invite code has been used the maximum number of times")
  }

  // Increment uses
  await supabase
    .from("invite_codes")
    .update({
      uses: record.uses + 1,
      consumed_at: record.uses + 1 >= record.max_uses ? new Date().toISOString() : null,
    })
    .eq("id", record.id)

  return record
}

function generateCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no ambiguous chars (0/O, 1/I/l)
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("")
}

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(code.toUpperCase())
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
