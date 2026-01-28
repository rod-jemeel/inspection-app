"use client"

import { Users, MapPin, Bell } from "@phosphor-icons/react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { NotificationSettings } from "@/components/notification-settings"

interface SettingsContentProps {
  location: {
    id: string
    name: string
    timezone: string
    active: boolean
  } | null
  teamMembers: {
    id: string
    name: string
    email: string
    role: string
  }[]
  canEdit: boolean
}

const roleVariant: Record<string, string> = {
  owner: "default",
  admin: "secondary",
  nurse: "outline",
  inspector: "outline",
}

export function SettingsContent({ location, teamMembers, canEdit }: SettingsContentProps) {
  if (!location) {
    return (
      <div className="py-20 text-center text-xs text-muted-foreground">
        Location not found
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-sm font-medium">Settings</h1>

      {/* Location info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin weight="bold" className="size-4" />
            Location Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Name</div>
              <div className="text-xs font-medium">{location.name}</div>
            </div>
            <Separator />
            <div>
              <div className="text-xs text-muted-foreground">Timezone</div>
              <div className="text-xs font-medium">{location.timezone}</div>
            </div>
            <Separator />
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <Badge variant={location.active ? "default" : "outline"}>
                {location.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell weight="bold" className="size-4" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationSettings />
        </CardContent>
      </Card>

      {/* Team members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users weight="bold" className="size-4" />
            Team Members ({teamMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No team members assigned
            </p>
          ) : (
            <div className="divide-y divide-border">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2.5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </div>
                  <Badge variant={(roleVariant[member.role] ?? "outline") as any} className="capitalize">
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
