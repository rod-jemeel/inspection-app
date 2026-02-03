"use client"

import { useState } from "react"
import { Bell, Mail, BellOff, Send } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
        setTestResult("No subscriptions found - enable push first")
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
    <div className="rounded-md border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-amber-500/10">
          <Bell className="size-4 text-amber-600" />
        </div>
        <div>
          <h3 className="text-xs font-semibold">Notifications</h3>
          <p className="text-[11px] text-muted-foreground">Manage alert preferences</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Push Notifications */}
        {!isSupported ? (
          <div className="flex items-start gap-3 rounded-md border bg-muted/50 p-3">
            <BellOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-xs font-medium">Push notifications unavailable</p>
              <p className="text-[11px] text-muted-foreground">
                Your browser doesn't support push notifications. On iOS, install this app to your
                home screen to enable notifications.
              </p>
            </div>
          </div>
        ) : permission === "denied" ? (
          <div className="flex items-start gap-3 rounded-md border bg-muted/50 p-3">
            <BellOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-xs font-medium">Notifications blocked</p>
              <p className="text-[11px] text-muted-foreground">
                You've blocked notifications. Update your browser settings to enable them.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications" className="text-xs font-medium">
                  Push Notifications
                </Label>
                <p className="text-[11px] text-muted-foreground">
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

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Test Push Notification */}
        {isSupported && isSubscribed && (
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div className="flex items-start gap-3">
              <Send className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Test Notification</p>
                <p className="text-[11px] text-muted-foreground">
                  Send a test push to verify notifications work
                </p>
                {testResult && (
                  <p className={`text-[11px] ${testResult.includes("sent") ? "text-green-600" : "text-muted-foreground"}`}>
                    {testResult}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestNotification}
              disabled={isSendingTest}
              className="h-7 text-xs"
            >
              {isSendingTest ? "Sending..." : "Send Test"}
            </Button>
          </div>
        )}

        {/* Email Notifications - placeholder for future */}
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="text-xs font-medium">
                Email Notifications
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Receive daily digest of pending inspections
              </p>
            </div>
          </div>
          <Switch id="email-notifications" defaultChecked />
        </div>
      </div>
    </div>
  )
}
