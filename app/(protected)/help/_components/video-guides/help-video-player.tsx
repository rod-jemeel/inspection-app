"use client"

import { useRef, useEffect, useState, useCallback, type ComponentType } from "react"
import { Player, type PlayerRef } from "@remotion/player"
import { COMP_WIDTH, COMP_HEIGHT, COMP_FPS, COMP_DURATION } from "./theme"

// Lazy-load compositions to avoid bundling all at once
const compositions: Record<string, () => Promise<{ default: ComponentType }>> = {
  "completing-inspection": () =>
    import("./compositions/completing-inspection").then((m) => ({
      default: m.CompletingInspection,
    })),
  "signing-inspection": () =>
    import("./compositions/signing-inspection").then((m) => ({
      default: m.SigningInspection,
    })),
  "creating-template": () =>
    import("./compositions/creating-template").then((m) => ({
      default: m.CreatingTemplate,
    })),
  "dashboard-overview": () =>
    import("./compositions/dashboard-overview").then((m) => ({
      default: m.DashboardOverview,
    })),
  "invite-code-flow": () =>
    import("./compositions/invite-code-flow").then((m) => ({
      default: m.InviteCodeFlow,
    })),
}

export function HelpVideoPlayer({ composition }: { composition: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerRef>(null)
  const [Comp, setComp] = useState<ComponentType | null>(null)

  // Lazy-load the composition
  useEffect(() => {
    const loader = compositions[composition]
    if (!loader) return
    loader().then((mod) => setComp(() => mod.default))
  }, [composition])

  // IntersectionObserver: autoplay when visible, pause when offscreen
  const handleVisibility = useCallback((entries: IntersectionObserverEntry[]) => {
    const player = playerRef.current
    if (!player) return
    for (const entry of entries) {
      if (entry.isIntersecting) {
        player.play()
      } else {
        player.pause()
      }
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(handleVisibility, {
      threshold: 0.4,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleVisibility])

  if (!Comp) {
    return (
      <div
        ref={containerRef}
        className="aspect-video w-full animate-pulse rounded-md border bg-muted"
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-md border"
      data-lenis-prevent
    >
      <Player
        ref={playerRef}
        component={Comp}
        compositionWidth={COMP_WIDTH}
        compositionHeight={COMP_HEIGHT}
        fps={COMP_FPS}
        durationInFrames={COMP_DURATION}
        loop
        autoPlay={false}
        controls={false}
        style={{ width: "100%" }}
        inputProps={{}}
      />
    </div>
  )
}
