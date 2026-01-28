// Service Worker for Push Notifications
// This file must be in the public directory to be served at /sw.js

const CACHE_NAME = "inspection-pwa-v1"

// Install event - cache static assets
self.addEventListener("install", (event) => {
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    })
  )
  self.clients.claim()
})

// Push event - show notification
self.addEventListener("push", (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = {
      title: "Inspection Tracker",
      body: event.data.text(),
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    vibrate: [100, 50, 100],
    tag: data.tag || "default",
    renotify: true,
    data: {
      url: data.url || "/dashboard",
    },
    actions: data.actions || [],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Notification click event - open or focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = event.notification.data?.url || "/dashboard"

  // Handle action buttons
  if (event.action === "view") {
    // Navigate to the specific URL
  } else if (event.action === "dismiss") {
    // Just close the notification (already done above)
    return
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if app is already open
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Open new window if not found
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

// Notification close event - track dismissals (optional)
self.addEventListener("notificationclose", (event) => {
  // Could send analytics here if needed
})
