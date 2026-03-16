import "server-only"

export interface WebhookPayload {
  event: string
  timestamp: string
  signature?: string
}

export interface AssignmentChangedPayload extends WebhookPayload {
  event: "assignment_changed"
  instance_id: string
  template_task: string
  new_assignee_profile_id: string | null
  new_assignee_email: string | null
  old_assignee_profile_id: string | null
  location_id: string
}

export interface InspectionCompletedPayload extends WebhookPayload {
  event: "inspection_completed"
  instance_id: string
  template_task: string
  status: string
  completed_by_profile_id: string
  location_id: string
}

export interface FormResponseSyncPayload extends WebhookPayload {
  event: "form_response_submitted" | "form_response_corrected"
  operation: "submitted" | "corrected"
  response_id: string
  revision_number: number
  form_template_id: string
  form_template_name: string
  binder_name: string | null
  location_id: string
  submitted_at: string
  original_submitted_at: string
  last_edited_at: string | null
  status: string
  overall_pass: boolean | null
  google_sheet_id: string | null
  google_sheet_tab: string | null
  submitted_by: {
    profile_id: string
    name: string | null
  }
  last_edited_by: {
    profile_id: string | null
    name: string | null
  } | null
  record: Record<string, string | number | boolean | null>
  media?: {
    completion_signature: string | null
    completion_selfie: string | null
  }
}

export interface N8nCallbackPayload {
  event: string
  success: boolean
  results?: {
    emailsSent?: number
    pushNotificationsSent?: number
    errors?: string[]
  }
}

export interface WebhookResponse {
  success: boolean
  message: string
  data?: unknown
}
