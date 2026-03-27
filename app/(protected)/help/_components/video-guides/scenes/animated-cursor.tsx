import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import { SPRING_SMOOTH } from "../theme"

type CursorStep = {
  frame: number
  x: number
  y: number
  click?: boolean
}

export function AnimatedCursor({ steps }: { steps: CursorStep[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (steps.length === 0) return null

  // Find current segment
  let segIndex = 0
  for (let i = 0; i < steps.length - 1; i++) {
    if (frame >= steps[i].frame) segIndex = i
  }

  const current = steps[segIndex]
  const next = steps[segIndex + 1]

  let x: number
  let y: number

  if (!next || frame < current.frame) {
    x = current.x
    y = current.y
  } else {
    const progress = spring({
      frame: frame - current.frame,
      fps,
      config: SPRING_SMOOTH,
      durationInFrames: Math.max(15, next.frame - current.frame),
    })
    x = interpolate(progress, [0, 1], [current.x, next.x])
    y = interpolate(progress, [0, 1], [current.y, next.y])
  }

  // Click ripple
  const isClicking = steps.some(
    (s) => s.click && frame >= s.frame && frame < s.frame + 12
  )
  const clickStep = steps.find(
    (s) => s.click && frame >= s.frame && frame < s.frame + 12
  )
  const clickProgress = clickStep
    ? interpolate(frame - clickStep.frame, [0, 12], [0, 1], {
        extrapolateRight: "clamp",
      })
    : 0

  return (
    <div
      style={{
        position: "absolute",
        left: x - 5,
        top: y - 2,
        pointerEvents: "none",
        zIndex: 100,
      }}
    >
      {/* Cursor arrow */}
      <svg width="32" height="40" viewBox="0 0 16 20" fill="none">
        <path
          d="M1 1L1 15L5.5 11L10 18L12.5 16.5L8 10L14 9L1 1Z"
          fill="#1f3447"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* Click ripple */}
      {isClicking && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "2px solid #5f97cf",
            opacity: interpolate(clickProgress, [0, 1], [0.8, 0]),
            transform: `scale(${interpolate(clickProgress, [0, 1], [0.3, 1.5])})`,
          }}
        />
      )}
    </div>
  )
}
