"use client"

import { useState, useEffect, useCallback } from "react"

interface PushSubscriptionState {
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  permission: NotificationPermission | null
  error: string | null
}

export function usePushNotifications() {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: null,
    error: null,
  })

  useEffect(() => {
    const checkSupport = async () => {
      // Check if push notifications are supported
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window

      if (!supported) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
        }))
        return
      }

      try {
        // Wait for service worker to be ready (registered by ServiceWorkerRegister component)
        const registration = await navigator.serviceWorker.ready

        // Check current subscription status
        const existingSub = await registration.pushManager.getSubscription()

        setState({
          isSupported: true,
          isSubscribed: !!existingSub,
          isLoading: false,
          permission: Notification.permission,
          error: null,
        })
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isSupported: true,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to check subscription",
        }))
      }
    }

    checkSupport()
  }, [])

  const subscribe = useCallback(async () => {
    if (!state.isSupported) return null

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      // Request notification permission
      const permission = await Notification.requestPermission()

      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          permission,
          error: "Notification permission denied",
        }))
        return null
      }

      const registration = await navigator.serviceWorker.ready

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as BufferSource,
      })

      // Save subscription to server
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      })

      if (!response.ok) {
        throw new Error("Failed to save subscription")
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        permission: "granted",
      }))

      return subscription
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to subscribe",
      }))
      return null
    }
  }, [state.isSupported])

  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Remove from server first
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })

        // Then unsubscribe locally
        await subscription.unsubscribe()
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to unsubscribe",
      }))
    }
  }, [])

  return {
    ...state,
    subscribe,
    unsubscribe,
  }
}

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
