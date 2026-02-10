"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Type, AlignLeft, Hash, Calendar as CalendarIcon, Clock, ToggleLeft, ChevronDown, CheckSquare, Thermometer, Gauge, PenLine, Camera, X, Plus, Loader2, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddFieldDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationId: string
  formId: string
  nextSortOrder: number
  onFieldAdded: (field: FormField) => void
}

interface FormField {
  id: string
  form_template_id: string
  label: string
  field_type: string
  required: boolean
  options: string[] | null
  validation_rules: Record<string, unknown> | null
  help_text: string | null
  placeholder: string | null
  default_value: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

const FIELD_TYPES = [
  { value: "text", label: "Short Text", icon: Type },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: CalendarIcon },
  { value: "datetime", label: "Date & Time", icon: Clock },
  { value: "boolean", label: "Yes / No", icon: ToggleLeft },
  { value: "select", label: "Dropdown", icon: ChevronDown },
  { value: "multi_select", label: "Checkboxes", icon: CheckSquare },
  { value: "temperature", label: "Temperature", icon: Thermometer },
  { value: "pressure", label: "Pressure", icon: Gauge },
  { value: "signature", label: "Signature", icon: PenLine },
  { value: "photo", label: "Photo", icon: Camera },
]

export function AddFieldDialog({
  open,
  onOpenChange,
  locationId,
  formId,
  nextSortOrder,
  onFieldAdded,
}: AddFieldDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedType, setSelectedType] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const [label, setLabel] = useState("")
  const [required, setRequired] = useState(true)
  const [options, setOptions] = useState<string[]>(["", ""])
  const [minValue, setMinValue] = useState("")
  const [maxValue, setMaxValue] = useState("")
  const [stepValue, setStepValue] = useState("")
  const [unit, setUnit] = useState("")
  const [helpText, setHelpText] = useState("")
  const [placeholder, setPlaceholder] = useState("")
  const [defaultValue, setDefaultValue] = useState("")

  const resetForm = () => {
    setStep(1)
    setSelectedType("")
    setLabel("")
    setRequired(true)
    setOptions(["", ""])
    setMinValue("")
    setMaxValue("")
    setStepValue("")
    setUnit("")
    setHelpText("")
    setPlaceholder("")
    setDefaultValue("")
  }

  const handleTypeSelect = (type: string) => {
    setSelectedType(type)
    if (type === "temperature") setUnit("°F")
    if (type === "pressure") setUnit("PSI")
    setStep(2)
  }

  const handleAddOption = () => {
    setOptions([...options, ""])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length <= 1) return
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleSubmit = async () => {
    if (!label.trim()) {
      toast.error("Please enter a question text")
      return
    }

    if ((selectedType === "select" || selectedType === "multi_select") && options.filter(o => o.trim()).length === 0) {
      toast.error("Please add at least one option")
      return
    }

    setLoading(true)
    try {
      const validationRules: Record<string, unknown> = {}
      if (selectedType === "number" || selectedType === "temperature" || selectedType === "pressure") {
        if (minValue) validationRules.min = parseFloat(minValue)
        if (maxValue) validationRules.max = parseFloat(maxValue)
        if (stepValue) validationRules.step = parseFloat(stepValue)
        if (unit) validationRules.unit = unit
      }

      const body = {
        label: label.trim(),
        field_type: selectedType,
        required,
        options: (selectedType === "select" || selectedType === "multi_select") ? options.filter(o => o.trim()) : null,
        validation_rules: Object.keys(validationRules).length > 0 ? validationRules : null,
        help_text: helpText.trim() || null,
        placeholder: placeholder.trim() || null,
        default_value: defaultValue.trim() || null,
        sort_order: nextSortOrder,
      }

      const response = await fetch(`/api/locations/${locationId}/forms/${formId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add field")
      }

      const field = await response.json()
      toast.success("Field added successfully")
      onFieldAdded(field)
      onOpenChange(false)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add field")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm()
    onOpenChange(open)
  }

  const showOptions = selectedType === "select" || selectedType === "multi_select"
  const showValidation = selectedType === "number" || selectedType === "temperature" || selectedType === "pressure"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xs">
            {step === 1 ? "Add Field - Select Type" : "Add Field - Configure"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-3 gap-2 py-2">
            {FIELD_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.value}
                  onClick={() => handleTypeSelect(type.value)}
                  className="flex flex-col items-center gap-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-center">{type.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Question text *</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Enter question text"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Required</Label>
              <Switch checked={required} onCheckedChange={setRequired} />
            </div>

            {showOptions && (
              <div className="space-y-2">
                <Label className="text-xs">Options</Label>
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(index)}
                        disabled={options.length <= 1}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  className="h-8 text-xs w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add option
                </Button>
              </div>
            )}

            {showValidation && (
              <div className="space-y-2">
                <Label className="text-xs">Validation rules</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      value={minValue}
                      onChange={(e) => setMinValue(e.target.value)}
                      placeholder="Min value"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={maxValue}
                      onChange={(e) => setMaxValue(e.target.value)}
                      placeholder="Max value"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={stepValue}
                      onChange={(e) => setStepValue(e.target.value)}
                      placeholder="Step"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Unit"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Help text (optional)</Label>
              <Textarea
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Add help text for this field"
                className="text-xs min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Placeholder (optional)</Label>
              <Input
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="Enter placeholder text"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Default value (optional)</Label>
              <Input
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder="Enter default value"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className="h-8 text-xs"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          {step === 2 && (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="h-8 text-xs"
            >
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Field
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
