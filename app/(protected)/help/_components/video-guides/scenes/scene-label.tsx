import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import { COLORS, SPRING_SMOOTH, COMP_HEIGHT } from "../theme"

type LabelStep = {
  frame: number
  text: string
}

export function SceneLabel({ steps }: { steps: LabelStep[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Find current label
  let current: LabelStep | null = null
  for (const step of steps) {
    if (frame >= step.frame) current = step
  }
  if (!current) return null

  const enterProgress = spring({
    frame: frame - current.frame,
    fps,
    config: SPRING_SMOOTH,
  })

  const opacity = interpolate(enterProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  })
  const translateY = interpolate(enterProgress, [0, 1], [8, 0], {
    extrapolateRight: "clamp",
  })

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: `${COLORS.sidebar}ee`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 50,
      }}
    >
      <span
        style={{
          color: COLORS.sidebarActive,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: 0.5,
        }}
      >
        {current.text}
      </span>
    </div>
  )
}
