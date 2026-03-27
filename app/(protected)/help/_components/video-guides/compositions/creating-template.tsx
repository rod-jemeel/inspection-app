import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion"
import { AnimatedCursor } from "../scenes/animated-cursor"
import { SceneLabel } from "../scenes/scene-label"
import { FocusOverlay } from "../scenes/focus-overlay"

export const CreatingTemplate = () => {
  const frame = useCurrentFrame()

  const scale = interpolate(frame, [0, 450], [1, 1.03], { extrapolateRight: "clamp" })

  return (
    <AbsoluteFill style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <img
          src="/help/screenshots/binder-forms.png"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            transformOrigin: "top right",
          }}
        />
      </div>

      <FocusOverlay
        areas={[
          // Binder header (icon + name + description)
          { start: 10, end: 80, x: 340, y: 25, w: 2200, h: 55 },
          // Tabs row (Forms, Inspections, Responses, Assignments)
          { start: 80, end: 150, x: 340, y: 80, w: 280, h: 55 },
          // New Form button
          { start: 150, end: 230, x: 2300, y: 88, w: 160, h: 36 },
          // Card grid - top section (first 2 rows of cards)
          { start: 230, end: 340, x: 340, y: 251, w: 2200, h: 290 },
          // Card grid - bottom section (next 2 rows)
          { start: 340, end: 420, x: 340, y: 555, w: 2200, h: 290 },
        ]}
      />

      <AnimatedCursor
        steps={[
          { frame: 0, x: 800, y: 40 },
          { frame: 10, x: 500, y: 50 },
          { frame: 80, x: 480, y: 108 },
          { frame: 150, x: 2380, y: 106 },
          { frame: 210, x: 2380, y: 106, click: true },
          { frame: 230, x: 700, y: 380 },
          { frame: 300, x: 1800, y: 380 },
          { frame: 340, x: 700, y: 680 },
          { frame: 400, x: 1800, y: 680 },
        ]}
      />

      <SceneLabel
        steps={[
          { frame: 0, text: "Open a binder to manage its forms" },
          { frame: 10, text: "Binder header shows name and description" },
          { frame: 80, text: "Switch between Forms, Inspections & Responses" },
          { frame: 150, text: "Click '+ New Form' to create a template" },
          { frame: 230, text: "Form cards show name, status & frequency" },
          { frame: 340, text: "Each form generates recurring inspections" },
        ]}
      />
    </AbsoluteFill>
  )
}
