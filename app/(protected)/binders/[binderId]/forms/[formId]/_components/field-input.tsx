"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Camera, PenLine, CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export interface FormField {
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

interface FieldInputProps {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  disabled?: boolean
}

function getValidationProp(
  rules: Record<string, unknown> | null,
  key: string
): number | undefined {
  if (!rules || rules[key] === undefined || rules[key] === null) return undefined
  return Number(rules[key])
}

function getUnit(rules: Record<string, unknown> | null): string {
  if (!rules || !rules.unit) return ""
  return String(rules.unit)
}

export function FieldInput({ field, value, onChange, error, disabled }: FieldInputProps) {
  const hasError = !!error
  const rules = field.validation_rules

  if (disabled) {
    return (
      <div className="pointer-events-none opacity-60" aria-disabled="true">
        <FieldInputInner field={field} value={value} onChange={onChange} error={error} />
      </div>
    )
  }

  return <FieldInputInner field={field} value={value} onChange={onChange} error={error} />
}

function FieldInputInner({ field, value, onChange, error }: Omit<FieldInputProps, "disabled">) {
  const hasError = !!error
  const rules = field.validation_rules

  switch (field.field_type) {
    case "text":
      return (
        <Input
          data-slot="field-input"
          type="text"
          placeholder={field.placeholder || undefined}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError || undefined}
          className="h-8 text-xs"
        />
      )

    case "textarea":
      return (
        <Textarea
          data-slot="field-input"
          placeholder={field.placeholder || undefined}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          aria-invalid={hasError || undefined}
        />
      )

    case "number":
      return (
        <Input
          data-slot="field-input"
          type="number"
          placeholder={field.placeholder || undefined}
          value={value !== null && value !== undefined ? String(value) : ""}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === "" ? null : Number(v))
          }}
          min={getValidationProp(rules, "min")}
          max={getValidationProp(rules, "max")}
          step={getValidationProp(rules, "step") ?? "any"}
          aria-invalid={hasError || undefined}
          className="h-8 text-xs"
        />
      )

    case "date": {
      const dateValue = value ? new Date(value as string) : undefined
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              data-slot="field-input"
              className={cn(
                "h-8 w-full justify-start text-left text-xs font-normal",
                !dateValue && "text-muted-foreground",
                hasError && "border-destructive"
              )}
            >
              <CalendarIcon className="mr-2 size-3.5" />
              {dateValue ? format(dateValue, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )
    }

    case "datetime": {
      const dtValue = value ? String(value) : ""
      const dtDate = dtValue ? new Date(dtValue) : undefined
      const timeStr = dtValue && dtValue.includes("T") ? dtValue.split("T")[1]?.slice(0, 5) : dtValue.slice(11, 16)
      return (
        <div data-slot="field-input" className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-8 flex-1 justify-start text-left text-xs font-normal",
                  !dtDate && "text-muted-foreground",
                  hasError && "border-destructive"
                )}
              >
                <CalendarIcon className="mr-2 size-3.5" />
                {dtDate ? format(dtDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dtDate}
                onSelect={(date) => {
                  if (date) {
                    const time = timeStr || "09:00"
                    onChange(`${format(date, "yyyy-MM-dd")}T${time}`)
                  } else {
                    onChange(null)
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            <Input
              type="time"
              value={timeStr || ""}
              onChange={(e) => {
                const dateStr = dtDate ? format(dtDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
                onChange(e.target.value ? `${dateStr}T${e.target.value}` : null)
              }}
              className="h-8 w-25 text-xs"
              aria-invalid={hasError || undefined}
            />
          </div>
        </div>
      )
    }

    case "boolean":
      return (
        <div data-slot="field-input" className="flex items-center gap-3 pt-0.5">
          <Switch
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked)}
            aria-invalid={hasError || undefined}
          />
          <span className="text-xs text-muted-foreground select-none">
            {value === true ? "Yes" : "No"}
          </span>
        </div>
      )

    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger
            data-slot="field-input"
            className={cn("h-8 w-full", hasError && "border-destructive")}
          >
            <SelectValue placeholder={field.placeholder || "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case "multi_select":
      return (
        <div data-slot="field-input" className="flex flex-col gap-2 pt-0.5">
          {(field.options ?? []).map((option) => {
            const selected = Array.isArray(value) ? value : []
            const isChecked = selected.includes(option)
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selected, option])
                    } else {
                      onChange(selected.filter((v: string) => v !== option))
                    }
                  }}
                  aria-invalid={hasError || undefined}
                />
                <span className="text-xs select-none">{option}</span>
              </label>
            )
          })}
          {(!field.options || field.options.length === 0) && (
            <p className="text-xs text-muted-foreground">No options configured</p>
          )}
        </div>
      )

    case "temperature": {
      const unit = getUnit(rules) || "\u00B0F"
      const min = getValidationProp(rules, "min")
      const max = getValidationProp(rules, "max")
      return (
        <div data-slot="field-input" className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={field.placeholder || undefined}
            value={value !== null && value !== undefined ? String(value) : ""}
            onChange={(e) => {
              const v = e.target.value
              onChange(v === "" ? null : Number(v))
            }}
            min={min}
            max={max}
            step={getValidationProp(rules, "step") ?? "any"}
            aria-invalid={hasError || undefined}
            className="h-8 flex-1 text-xs"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>
          {(min !== undefined || max !== undefined) && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              ({min !== undefined ? `${min}` : ""}
              {min !== undefined && max !== undefined ? " \u2013 " : ""}
              {max !== undefined ? `${max}` : ""})
            </span>
          )}
        </div>
      )
    }

    case "pressure": {
      const unit = getUnit(rules) || "PSI"
      const min = getValidationProp(rules, "min")
      const max = getValidationProp(rules, "max")
      return (
        <div data-slot="field-input" className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={field.placeholder || undefined}
            value={value !== null && value !== undefined ? String(value) : ""}
            onChange={(e) => {
              const v = e.target.value
              onChange(v === "" ? null : Number(v))
            }}
            min={min}
            max={max}
            step={getValidationProp(rules, "step") ?? "any"}
            aria-invalid={hasError || undefined}
            className="h-8 flex-1 text-xs"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>
          {(min !== undefined || max !== undefined) && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              ({min !== undefined ? `${min}` : ""}
              {min !== undefined && max !== undefined ? " \u2013 " : ""}
              {max !== undefined ? `${max}` : ""})
            </span>
          )}
        </div>
      )
    }

    case "signature":
      return (
        <div
          data-slot="field-input"
          className="flex items-center gap-2.5 rounded-md border border-dashed border-input bg-muted/30 px-4 py-5"
        >
          <PenLine className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Signature capture coming soon
          </span>
        </div>
      )

    case "photo":
      return (
        <div
          data-slot="field-input"
          className="flex items-center gap-2.5 rounded-md border border-dashed border-input bg-muted/30 px-4 py-5"
        >
          <Camera className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Photo upload coming soon
          </span>
        </div>
      )

    default:
      return (
        <div
          data-slot="field-input"
          className="rounded-md border border-dashed border-input bg-muted/30 px-4 py-3"
        >
          <span className="text-xs text-muted-foreground">
            Unsupported field type: {field.field_type}
          </span>
        </div>
      )
  }
}
