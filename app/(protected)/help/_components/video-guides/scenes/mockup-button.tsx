import { useCurrentFrame, interpolate } from "remotion"
import { COLORS } from "../theme"

export function MockupButton({
  label,
  x,
  y,
  width = 100,
  height = 28,
  variant = "primary",
  clickAtFrame,
  appearAtFrame = 0,
}: {
  label: string
  x: number
  y: number
  width?: number
  height?: number
  variant?: "primary" | "outline" | "green"
  clickAtFrame?: number
  appearAtFrame?: number
}) {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [appearAtFrame, appearAtFrame + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  const isClicked =
    clickAtFrame !== undefined &&
    frame >= clickAtFrame &&
    frame < clickAtFrame + 8
  const clickScale = isClicked
    ? interpolate(frame - clickAtFrame, [0, 4, 8], [1, 0.95, 1], {
        extrapolateRight: "clamp",
      })
    : 1

  const bg =
    variant === "primary"
      ? COLORS.primary
      : variant === "green"
        ? COLORS.green
        : "transparent"
  const color =
    variant === "outline" ? COLORS.foreground : COLORS.background
  const border =
    variant === "outline" ? `1px solid ${COLORS.border}` : "none"

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        background: bg,
        color,
        border,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 600,
        opacity,
        transform: `scale(${clickScale})`,
        cursor: "default",
      }}
    >
      {label}
    </div>
  )
}
