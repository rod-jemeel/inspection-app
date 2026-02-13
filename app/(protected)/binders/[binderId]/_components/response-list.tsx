"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/loading-spinner"
import { cn } from "@/lib/utils"
import type { ResponseStatus } from "@/lib/validations/form-response"

interface FormResponse {
  id: string
  form_template_id: string
  location_id: string
  submitted_by_profile_id: string
  submitted_at: string
  status: ResponseStatus
  overall_pass: boolean | null
  remarks: string | null
  submitted_by_name: string | null
  form_template_name: string | null
}

interface ResponseListProps {
  binderId: string
  locationId: string
}

const statusColors = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  complete: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  flagged: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
}

const statusLabels = {
  draft: "Draft",
  complete: "Complete",
  flagged: "Flagged",
}

export function ResponseList({ binderId, locationId }: ResponseListProps) {
  const router = useRouter()
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ResponseStatus | "all">("all")

  const fetchResponses = useCallback(async () => {
    setLoading(true)
    try {
      const url = new URL(`/api/locations/${locationId}/binders/${binderId}/responses`, window.location.origin)
      url.searchParams.set("limit", "50")

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error("Failed to fetch responses")

      const data = await res.json()
      setResponses(data.responses || [])
    } catch (error) {
      console.error("Error fetching responses:", error)
      setResponses([])
    } finally {
      setLoading(false)
    }
  }, [binderId, locationId])

  useEffect(() => {
    fetchResponses()
  }, [fetchResponses])

  const filteredResponses = useMemo(() => {
    if (statusFilter === "all") return responses
    return responses.filter((r) => r.status === statusFilter)
  }, [responses, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
          className="h-8 text-xs"
        >
          All
        </Button>
        <Button
          variant={statusFilter === "complete" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("complete")}
          className="h-8 text-xs"
        >
          Complete
        </Button>
        <Button
          variant={statusFilter === "draft" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("draft")}
          className="h-8 text-xs"
        >
          Draft
        </Button>
        <Button
          variant={statusFilter === "flagged" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("flagged")}
          className="h-8 text-xs"
        >
          Flagged
        </Button>
      </div>

      {/* Response List */}
      {filteredResponses.length > 0 ? (
        <div className="space-y-2">
          {filteredResponses.map((response) => (
            <div
              key={response.id}
              className="group flex cursor-pointer items-center gap-3 rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => {
                router.push(
                  `/binders/${binderId}/forms/${response.form_template_id}?loc=${locationId}&responseId=${response.id}`
                )
              }}
            >
              {/* Form Name & Submitted By */}
              <div className="flex-1 space-y-0.5">
                <h4 className="text-sm font-medium">
                  {response.form_template_name || "Unnamed Form"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  by {response.submitted_by_name || "Unknown"}
                </p>
              </div>

              {/* Date & Time */}
              <div className="text-right text-xs text-muted-foreground">
                <div>{new Date(response.submitted_at).toLocaleDateString()}</div>
                <div>{new Date(response.submitted_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              </div>

              {/* Status Badge */}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-medium",
                  statusColors[response.status]
                )}
              >
                {statusLabels[response.status]}
              </Badge>

              {/* Pass/Fail Badge */}
              {response.overall_pass !== null && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium",
                    response.overall_pass
                      ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                  )}
                >
                  {response.overall_pass ? "Pass" : "Fail"}
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-16">
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            {statusFilter === "all"
              ? "No responses yet"
              : `No ${statusFilter} responses`}
          </p>
          <p className="text-xs text-muted-foreground">
            Responses will appear here once forms are submitted
          </p>
        </div>
      )}

      {/* Results count */}
      {responses.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {filteredResponses.length} of {responses.length}{" "}
          {responses.length === 1 ? "response" : "responses"}
        </p>
      )}

    </div>
  )
}
