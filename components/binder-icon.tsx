import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  FileText,
  Folder,
  FolderOpen,
  Hand,
  HeartPulse,
  Microscope,
  Shield,
  Stethoscope,
  Thermometer,
} from "lucide-react"

export interface BinderIconOption {
  Icon: LucideIcon
  label: string
  value: string
}

export const BINDER_ICON_OPTIONS: BinderIconOption[] = [
  { Icon: Folder, label: "Folder", value: "folder" },
  { Icon: FolderOpen, label: "Open Folder", value: "folder-open" },
  { Icon: FileText, label: "File", value: "file" },
  { Icon: Hand, label: "Hand", value: "hand" },
  { Icon: Shield, label: "Shield", value: "shield" },
  { Icon: HeartPulse, label: "Heart Pulse", value: "heart-pulse" },
  { Icon: ClipboardList, label: "Checklist", value: "clipboard-list" },
  { Icon: Microscope, label: "Microscope", value: "microscope" },
  { Icon: Stethoscope, label: "Stethoscope", value: "stethoscope" },
  { Icon: Thermometer, label: "Thermometer", value: "thermometer" },
]

const ICON_ALIASES: Record<string, string> = {
  clipboard_list: "clipboard-list",
  folder_open: "folder-open",
  heart_pulse: "heart-pulse",
}

const ICON_OPTION_MAP = new Map(
  BINDER_ICON_OPTIONS.map((option) => [option.value, option])
)

function normalizeBinderIcon(value?: string | null) {
  if (!value) return "folder-open"

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-")
  return ICON_ALIASES[normalized] ?? normalized
}

export function getBinderIconOption(value?: string | null) {
  const normalized = normalizeBinderIcon(value)
  return ICON_OPTION_MAP.get(normalized) ?? ICON_OPTION_MAP.get("folder-open")!
}
