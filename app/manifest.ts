import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Summit Inspection Tracker",
    short_name: "Summit",
    description: "Multi-location inspection checklists with signature capture for Summit teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf1",
    theme_color: "#5f97cf",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
