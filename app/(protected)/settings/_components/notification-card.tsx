"use client"

import { useState } from "react"
import { Bell, BellOff, Mail, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { usePushNotifications } from "@/hooks/use-push-notifications"

export function NotificationCard() {
  const { isSupported, isSubscribed, isLoading, permission, error, subscribe, unsubscribe } =
    usePushNotifications()
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  async function sendTestNotification() {
    setIsSendingTest(true)
    setTestResult(null)
    try {
      const response = await fetch("/api/push/test", { method: "POST" })
      const data = await response.json()
      if (response.ok && data.sent > 0) {
        setTestResult("Test notification sent!")
      } else if (data.sent === 0) {
        setTestResult("No subscriptions found. Enable push first.")
      } else {
        setTestResult(data.error?.message || "Failed to send")
      }
    } catch {
      setTestResult("Failed to send test notification")
    } finally {
      setIsSendingTest(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="space-y-4">
        {!isSupported ? (
          <div className="flex items-start gap-3 py-1">
            <BellOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Push notifications unavailable</p>
              <p className="text-xs leading-5 text-muted-foreground">
                This browser does not support push notifications. On iOS, add the app to your
                home screen to enable them.
              </p>
            </div>
          </div>
        ) : permission === "denied" ? (
          <div className="flex items-start gap-3 py-1">
            <BellOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Notifications blocked</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Your browser has blocked notifications. Update browser settings to allow them.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-4">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications" className="text-xs font-medium">
                  Push Notifications
                </Label>
                <p className="text-xs leading-5 text-muted-foreground">
                  Get alerts for overdue inspections and assignments
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
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {isSupported && isSubscribed ? (
          <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-4">
            <div className="flex items-start gap-3">
              <Send className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Test Push Notification</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Send a sample push to verify this device is receiving alerts.
                </p>
                {testResult ? (
                  <p className="text-xs text-muted-foreground">{testResult}</p>
                ) : null}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestNotification}
              disabled={isSendingTest}
            >
              {isSendingTest ? "Sending..." : "Send Test"}
            </Button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="text-xs font-medium">
                Email Notifications
              </Label>
              <p className="text-xs leading-5 text-muted-foreground">
                Receive a digest of pending inspections and reminders.
              </p>
            </div>
          </div>
          <Switch id="email-notifications" defaultChecked />
        </div>
      </div>
    </section>
  )
}
