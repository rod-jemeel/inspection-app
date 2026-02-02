import "server-only"
import { supabase } from "@/lib/server/db"
import { ApiError } from "@/lib/server/errors"

export interface InspectionEvent {
  id: string
  inspection_instance_id: string
  event_type: string
  event_at: string
  actor_profile_id: string | null
  payload: Record<string, unknown> | null
}

export async function listEvents(instanceId: string) {
  const { data, error } = await supabase
    .from("inspection_events")
    .select("id, inspection_instance_id, event_type, event_at, actor_profile_id, payload")
    .eq("inspection_instance_id", instanceId)
    .order("event_at", { ascending: true })

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as InspectionEvent[]
}

export async function appendEvent(
  instanceId: string,
  eventType: string,
  actorProfileId: string | null,
  payload?: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("inspection_events")
    .insert({
      inspection_instance_id: instanceId,
      event_type: eventType,
      actor_profile_id: actorProfileId,
      payload: payload ?? null,
    })
    .select()
    .single()

  if (error) throw new ApiError("INTERNAL_ERROR", error.message)
  return data as InspectionEvent
}
