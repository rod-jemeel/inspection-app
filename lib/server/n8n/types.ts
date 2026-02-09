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
