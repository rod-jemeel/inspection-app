import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import { COLORS, SPRING_SNAPPY } from "../theme"

export function MockupModal({
  title,
  appearAtFrame,
  width = 280,
  height = 220,
  children,
}: {
  title: string
  appearAtFrame: number
  width?: number
  height?: number
  children: React.ReactNode
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (frame < appearAtFrame) return null

  const progress = spring({
    frame: frame - appearAtFrame,
    fps,
    config: SPRING_SNAPPY,
  })

  const scale = interpolate(progress, [0, 1], [0.85, 1])
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  })

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          opacity,
          zIndex: 40,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width,
          marginLeft: -width / 2,
          marginTop: -height / 2,
          background: COLORS.background,
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          opacity,
          transform: `scale(${scale})`,
          zIndex: 45,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${COLORS.border}`,
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.foreground,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {title}
          <span style={{ color: COLORS.mutedForeground, fontSize: 14 }}>
            ×
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </>
  )
}
