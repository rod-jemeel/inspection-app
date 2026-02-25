import "server-only"
import fs from "node:fs/promises"
import path from "node:path"
import { ApiError } from "@/lib/server/errors"
import type { ExportableLogType } from "@/lib/validations/log-export"

type TemplateKey =
  | "narcotic_signout"
  | "daily_narcotic_count"
  | "cardiac_arrest_record"
  | "crash_cart_daily"
  | "crash_cart_monthly"
  | "inventory_fentanyl"
  | "inventory_versed"
  | "inventory_ephedrine"
  | "inventory_generic"

const TEMPLATE_DIR = path.join(process.cwd(), "public", "pdf-templates", "log-forms")

const TEMPLATE_FILE: Record<TemplateKey, string> = {
  narcotic_signout: "Anesthesiologist-CRNA Narcotic Sign-Out Form.pdf",
  daily_narcotic_count: "Daily Narcotic Count.pdf",
  cardiac_arrest_record: "Cardiac Arrest Record.pdf",
  crash_cart_daily: "Crash Cart DAILY Checklist.pdf",
  crash_cart_monthly: "Crash Cart MONTHLY Checklist.pdf",
  inventory_fentanyl: "Controlled Subtances Perpetual Inventory Form - FENTANYL.pdf",
  inventory_versed: "Controlled Subtances Perpetual Inventory Form - VERSED.pdf",
  inventory_ephedrine: "Controlled Substances Perpetual Inventory Form - EPHEDRINE INJECTION.pdf",
  inventory_generic: "Controlled Subtances Perpetual Inventory Form - VERSED.pdf",
}

const cache = new Map<string, Uint8Array>()

async function readTemplate(fileName: string): Promise<Uint8Array> {
  const cached = cache.get(fileName)
  if (cached) return cached
  const filePath = path.join(TEMPLATE_DIR, fileName)
  try {
    const bytes = new Uint8Array(await fs.readFile(filePath))
    cache.set(fileName, bytes)
    return bytes
  } catch {
    throw new ApiError("INTERNAL_ERROR", `Missing PDF template: ${fileName}`)
  }
}

export async function getTemplateBytes(templateKey: TemplateKey): Promise<Uint8Array> {
  return readTemplate(TEMPLATE_FILE[templateKey])
}

export async function getCrashCartMonthlyTemplateBytes(): Promise<Uint8Array> {
  return getTemplateBytes("crash_cart_monthly")
}

export function resolveInventoryTemplateKey(drugSlug: string): TemplateKey {
  const s = drugSlug.toLowerCase()
  if (s === "fentanyl") return "inventory_fentanyl"
  if (s === "versed") return "inventory_versed"
  if (s === "ephedrine") return "inventory_ephedrine"
  return "inventory_generic"
}

export function templateLabelForLogType(logType: ExportableLogType): string {
  switch (logType) {
    case "narcotic_signout":
      return "Anesthesiologist-CRNA Narcotic Sign-Out Form"
    case "daily_narcotic_count":
      return "Daily Narcotic Count"
    case "cardiac_arrest_record":
      return "Cardiac Arrest Record"
    case "crash_cart_daily":
      return "Crash Cart DAILY Checklist"
    case "crash_cart_checklist":
      return "Crash Cart MONTHLY Checklist"
    case "controlled_substance_inventory":
      return "Controlled Substance Inventory"
    case "narcotic_log":
      return "Narcotic Log"
    default:
      return logType
  }
}

