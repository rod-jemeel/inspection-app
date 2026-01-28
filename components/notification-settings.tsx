"use client"

import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Bell, BellOff } from "lucide-react"

export function NotificationSettings() {
  const { isSupported, isSubscribed, isLoading, permission, error, subscribe, unsubscribe } =
    usePushNotifications()

  if (!isSupported) {
    return (
      <div className="flex items-start gap-3 rounded-none border border-border bg-muted/50 p-3">
        <BellOff className="mt-0.5 size-4 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-xs font-medium">Push notifications unavailable</p>
          <p className="text-xs text-muted-foreground">
            Your browser or device doesn't support push notifications. On iOS, install this app to
            your home screen to enable notifications.
          </p>
        </div>
      </div>
    )
  }

  if (permission === "denied") {
    return (
      <div className="flex items-start gap-3 rounded-none border border-border bg-muted/50 p-3">
        <BellOff className="mt-0.5 size-4 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-xs font-medium">Notifications blocked</p>
          <p className="text-xs text-muted-foreground">
            You've blocked notifications for this site. To enable them, update your browser or device
            notification settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 size-4" />
          <div className="space-y-0.5">
            <Label htmlFor="push-notifications" className="text-xs font-medium">
              Push Notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              Get notified about overdue inspections and assignments
            </p>
          </div>
        </div>
        <Switch
          id="push-notifications"
          checked={isSubscribed}
          disabled={isLoading}
          onCheckedChange={(checked) => {
            if (checked) {
              subscribe()
            } else {
              unsubscribe()
            }
          }}
        />
      </div>

      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}

      {isSubscribed && (
        <p className="text-xs text-muted-foreground">
          Notifications enabled. You'll receive alerts for overdue inspections and new assignments.
        </p>
      )}
    </div>
  )
}
