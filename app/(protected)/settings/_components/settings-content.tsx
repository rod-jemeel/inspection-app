"use client"

import { LocationCard } from "./location-card"
import { NotificationCard } from "./notification-card"
import { DangerZone } from "./danger-zone"
import { ReminderSettingsCard } from "./reminder-settings-card"
import { MySignatureCard } from "./my-signature-card"
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

export function SettingsContent({ location, canEdit, isOwner, reminderSettings, profileSignature, profileInitials }: SettingsContentProps) {
  return (
    <div className="space-y-6">
      {/* Bento Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Location Card - spans 2 cols */}
        <LocationCard location={location} canEdit={canEdit} isOwner={isOwner} />

        {/* My Signature Card */}
        <MySignatureCard initialSignature={profileSignature} initialInitials={profileInitials} />

        {/* Notification Card */}
        <NotificationCard />

        {/* Reminder Settings - Owner only, spans full width */}
        {isOwner && reminderSettings && (
          <ReminderSettingsCard initialSettings={reminderSettings} />
        )}

        {/* Danger Zone - Owner only, spans full width */}
        {isOwner && <DangerZone locationId={location.id} isActive={location.active} />}
      </div>
    </div>
  )
}
