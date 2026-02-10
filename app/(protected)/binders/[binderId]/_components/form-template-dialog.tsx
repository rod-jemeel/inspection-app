"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface FormTemplate {
  id: string
  binder_id: string
  name: string
  description: string | null
  instructions: string | null
  frequency: string | null
  sort_order: number
  active: boolean
  google_sheet_id: string | null
  google_sheet_tab: string | null
}

interface FormTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  locationId: string
  binderId: string
  template?: FormTemplate | null
}

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "every_3_years", label: "Every 3 Years" },
  { value: "as_needed", label: "As Needed" },
]

export function FormTemplateDialog({
  open,
  onOpenChange,
  onSuccess,
  locationId,
  binderId,
  template,
}: FormTemplateDialogProps) {
  const isEditMode = !!template

  const [name, setName] = useState(template?.name || "")
  const [description, setDescription] = useState(template?.description || "")
  const [instructions, setInstructions] = useState(template?.instructions || "")
  const [frequency, setFrequency] = useState(template?.frequency || "")
  const [googleSheetId, setGoogleSheetId] = useState(template?.google_sheet_id || "")
  const [googleSheetTab, setGoogleSheetTab] = useState(template?.google_sheet_tab || "")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Form name is required")
      return
    }

    setIsLoading(true)

    try {
      const url = isEditMode
        ? `/api/locations/${locationId}/forms/${template.id}`
        : `/api/locations/${locationId}/binders/${binderId}/forms`

      const method = isEditMode ? "PATCH" : "POST"

      const body: Record<string, string> = {
        name: name.trim(),
      }

      if (description.trim()) {
        body.description = description.trim()
      }

      if (instructions.trim()) {
        body.instructions = instructions.trim()
      }

      if (frequency) {
        body.frequency = frequency
      }

      if (googleSheetId.trim()) {
        body.google_sheet_id = googleSheetId.trim()
      }

      if (googleSheetTab.trim()) {
        body.google_sheet_tab = googleSheetTab.trim()
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save form template")
      }

      toast.success(
        isEditMode
          ? "Form template updated successfully"
          : "Form template created successfully"
      )

      onSuccess()
      onOpenChange(false)

      // Reset form if creating new
      if (!isEditMode) {
        setName("")
        setDescription("")
        setInstructions("")
        setFrequency("")
        setGoogleSheetId("")
        setGoogleSheetTab("")
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save form template"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
      // Reset form when closing if not in edit mode
      if (!newOpen && !isEditMode) {
        setName("")
        setDescription("")
        setInstructions("")
        setFrequency("")
        setGoogleSheetId("")
        setGoogleSheetTab("")
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Form Template" : "New Form Template"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs">
              Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Safety Checklist"
              className="h-8 text-xs"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this form..."
              className="min-h-[60px] text-xs"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions" className="text-xs">
              Instructions
            </Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Instructions shown to user when filling this form..."
              className="min-h-[60px] text-xs"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency" className="text-xs">
              Frequency
            </Label>
            <Select value={frequency} onValueChange={setFrequency} disabled={isLoading}>
              <SelectTrigger id="frequency" className="h-8 text-xs">
                <SelectValue placeholder="Select frequency..." />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-xs"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleSheetId" className="text-xs">
              Google Sheet ID
            </Label>
            <Input
              id="googleSheetId"
              value={googleSheetId}
              onChange={(e) => setGoogleSheetId(e.target.value)}
              placeholder="From URL: docs.google.com/spreadsheets/d/{ID}/..."
              className="h-8 text-xs font-mono"
              disabled={isLoading}
            />
            <p className="text-[10px] text-muted-foreground">
              Paste the spreadsheet ID from the Google Sheets URL to enable sync
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleSheetTab" className="text-xs">
              Sheet Tab Name
            </Label>
            <Input
              id="googleSheetTab"
              value={googleSheetTab}
              onChange={(e) => setGoogleSheetTab(e.target.value)}
              placeholder="e.g., Sheet1 (defaults to first tab)"
              className="h-8 text-xs"
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="h-8 text-xs">
              {isLoading ? "Saving..." : isEditMode ? "Save Changes" : "Create Form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
