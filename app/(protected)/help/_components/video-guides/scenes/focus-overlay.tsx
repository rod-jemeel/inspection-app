import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import { SPRING_SMOOTH } from "../theme"

type FocusArea = {
  start: number
  end: number
  x: number
  y: number
  w: number
  h: number
}

export function FocusOverlay({ areas }: { areas: FocusArea[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  for (const area of areas) {
    if (frame >= area.start && frame < area.end) {
      const enter = spring({ frame: frame - area.start, fps, config: SPRING_SMOOTH })
      const fadeIn = interpolate(enter, [0, 1], [0, 1], { extrapolateRight: "clamp" })
      const fadeOut =
        area.end - frame < 15
          ? interpolate(frame, [area.end - 15, area.end], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 1
      const pad = 6
      return (
        <div
          style={{
            position: "absolute",
            left: area.x - pad,
            top: area.y - pad,
            width: area.w + pad * 2,
            height: area.h + pad * 2,
            borderRadius: 10,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
            border: "2px solid rgba(255,255,255,0.5)",
            opacity: fadeIn * fadeOut,
            zIndex: 10,
            pointerEvents: "none",
          }}
        />
      )
    }
  }
  return null
}
