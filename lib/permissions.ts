/**
 * Client-safe permission checks for conditional UI rendering.
 * These mirror the server-side checks in auth-helpers.ts.
 */

export type Role = "owner" | "admin" | "nurse" | "inspector"

export interface ProfilePermissions {
  role: Role
  can_manage_binders: boolean
  can_manage_forms: boolean
  can_view_all_responses: boolean
  can_export_reports: boolean
  can_configure_integrations: boolean
}

export function canManageBinders(profile: ProfilePermissions | null | undefined): boolean {
  if (!profile) return false
  return profile.role === "owner" || profile.can_manage_binders
}

export function canManageForms(profile: ProfilePermissions | null | undefined): boolean {
  if (!profile) return false
  return profile.role === "owner" || profile.can_manage_forms
}

export function canViewAllResponses(profile: ProfilePermissions | null | undefined): boolean {
  if (!profile) return false
  return profile.role === "owner" || profile.can_view_all_responses
}

export function canExportReports(profile: ProfilePermissions | null | undefined): boolean {
  if (!profile) return false
  return profile.role === "owner" || profile.can_export_reports
}

export function canConfigureIntegrations(profile: ProfilePermissions | null | undefined): boolean {
  if (!profile) return false
  return profile.role === "owner" || profile.can_configure_integrations
}

export function isOwnerOrAdmin(profile: ProfilePermissions | null | undefined): boolean {
  if (!profile) return false
  return profile.role === "owner" || profile.role === "admin"
}

export function isManagementRole(profile: ProfilePermissions | null | undefined): boolean {
  if (!profile) return false
  return ["owner", "admin"].includes(profile.role)
}

/** All roles that can submit form responses */
export const FORM_SUBMITTER_ROLES: Role[] = ["owner", "admin", "nurse", "inspector"]

/** Roles that can manage users */
export const USER_MANAGEMENT_ROLES: Role[] = ["owner", "admin"]

/** Roles that can see all binders (not assignment-restricted) */
export const ALL_BINDERS_ROLES: Role[] = ["owner", "admin"]
