import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion"
import { AnimatedCursor } from "../scenes/animated-cursor"
import { SceneLabel } from "../scenes/scene-label"
import { FocusOverlay } from "../scenes/focus-overlay"

export const DashboardOverview = () => {
  const frame = useCurrentFrame()

  // Gentle zoom-in on the screenshot over the full duration
  const scale = interpolate(frame, [0, 450], [1, 1.04], { extrapolateRight: "clamp" })

  return (
    <AbsoluteFill style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <img
          src="/help/screenshots/dashboard.png"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            transformOrigin: "center top",
          }}
        />
      </div>

      <FocusOverlay
        areas={[
          // Page header / alerts area
          { start: 20, end: 100, x: 340, y: 20, w: 2185, h: 52 },
          // KPI cards row (Pending, Overdue, Due This Week, Passed, Failed, Compliance)
          { start: 100, end: 220, x: 340, y: 80, w: 2185, h: 67 },
          // Overdue inspections table section
          { start: 220, end: 380, x: 340, y: 180, w: 2185, h: 690 },
        ]}
      />

      <AnimatedCursor
        steps={[
          { frame: 0, x: 800, y: 40 },
          { frame: 20, x: 900, y: 45 },
          { frame: 100, x: 600, y: 115 },
          { frame: 160, x: 2000, y: 115 },
          { frame: 220, x: 700, y: 400 },
          { frame: 300, x: 700, y: 650 },
          { frame: 380, x: 800, y: 500 },
        ]}
      />

      <SceneLabel
        steps={[
          { frame: 0, text: "Your dashboard overview" },
          { frame: 20, text: "Alerts show team members needing attention" },
          { frame: 100, text: "KPI cards: pending, overdue, compliance at a glance" },
          { frame: 220, text: "Overdue inspections with send-reminder actions" },
          { frame: 380, text: "Scroll down for calendar & analytics" },
        ]}
      />
    </AbsoluteFill>
  )
}
