"use client"

import {
  AlertTriangle,
  Bell,
  Clock3,
  MapPin,
  PenLine,
  Settings2,
} from "lucide-react"
import { DangerZone } from "./danger-zone"
import { LocationCard } from "./location-card"
import { MySignatureCard } from "./my-signature-card"
import { NotificationCard } from "./notification-card"
import { ReminderSettingsCard } from "./reminder-settings-card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ReminderSettings } from "@/lib/validations/reminder-settings"

interface Location {
  id: string
  name: string
  address: string | null
  timezone: string
  active: boolean
  created_at: string
  updated_at: string
}

interface SettingsContentProps {
  location: Location
  canEdit: boolean
  isOwner: boolean
  reminderSettings: ReminderSettings | null
  profileSignature: string | null
  profileInitials: string | null
}

interface SettingsTabIntroProps {
  eyebrow?: string
  title: string
  description: string
}

function SettingsTabIntro({ eyebrow, title, description }: SettingsTabIntroProps) {
  return (
    <header className="space-y-1">
      {eyebrow ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </header>
  )
}

export function SettingsContent({
  location,
  canEdit,
  isOwner,
  reminderSettings,
  profileSignature,
  profileInitials,
}: SettingsContentProps) {
  const roleLabel = isOwner ? "Owner" : canEdit ? "Admin" : "Member"

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-border/60">
            <Settings2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Manage workspace details, signing preferences, alerts, and operational controls.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px]">
            {location.name}
          </Badge>
          <Badge variant={location.active ? "default" : "secondary"} className="text-[10px]">
            {location.active ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {location.timezone}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {roleLabel}
          </Badge>
        </div>
      </header>

      <Tabs defaultValue="workspace" className="gap-6">
        <TabsList className="h-auto w-full flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="workspace" className="gap-2 rounded-xl px-3 py-2 text-xs">
            <MapPin className="size-3.5" />
            Workspace
          </TabsTrigger>
          <TabsTrigger value="signature" className="gap-2 rounded-xl px-3 py-2 text-xs">
            <PenLine className="size-3.5" />
            Signature
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 rounded-xl px-3 py-2 text-xs">
            <Bell className="size-3.5" />
            Notifications
          </TabsTrigger>
          {isOwner && reminderSettings ? (
            <TabsTrigger value="reminders" className="gap-2 rounded-xl px-3 py-2 text-xs">
              <Clock3 className="size-3.5" />
              Reminders
            </TabsTrigger>
          ) : null}
          {isOwner ? (
            <TabsTrigger value="danger" className="gap-2 rounded-xl px-3 py-2 text-xs">
              <AlertTriangle className="size-3.5" />
              Danger Zone
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <SettingsTabIntro
            eyebrow="Workspace"
            title="Location Details"
            description="Update the facility name, address, timezone, and active state for this location."
          />
          <LocationCard location={location} canEdit={canEdit} isOwner={isOwner} />
        </TabsContent>

        <TabsContent value="signature" className="space-y-4">
          <SettingsTabIntro
            eyebrow="Signature"
            title="Saved signature and initials"
            description="Keep your signature ready so logs and exported PDFs can use it consistently."
          />
          <MySignatureCard
            initialSignature={profileSignature}
            initialInitials={profileInitials}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <SettingsTabIntro
            eyebrow="Notifications"
            title="Push and email notifications"
            description="Control how reminders and urgent messages reach this device and account."
          />
          <NotificationCard />
        </TabsContent>

        {isOwner && reminderSettings ? (
          <TabsContent value="reminders" className="space-y-4">
            <SettingsTabIntro
              eyebrow="Workflow Automation"
              title="Reminder timing"
              description="Decide how far ahead recurring inspections should begin notifying staff."
            />
            <ReminderSettingsCard initialSettings={reminderSettings} />
          </TabsContent>
        ) : null}

        {isOwner ? (
          <TabsContent value="danger" className="space-y-4">
            <SettingsTabIntro
              eyebrow="Protected Controls"
              title="Activation and recovery"
              description="Use this area carefully. Changes here affect scheduling behavior for the full location."
            />
            <DangerZone locationId={location.id} isActive={location.active} />
          </TabsContent>
        ) : null}
      </Tabs>
    </main>
  )
}
