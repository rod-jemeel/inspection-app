import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import { SPRING_SMOOTH } from "../theme"
import { AnimatedCursor } from "../scenes/animated-cursor"
import { SceneLabel } from "../scenes/scene-label"
import { FocusOverlay } from "../scenes/focus-overlay"

export const CompletingInspection = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Phase 1: Inspections list (frames 0-90)
  // Phase 2: Crossfade to inspection detail modal (frames 90-110)
  // Phase 3: Inspection detail with highlights (frames 110-450)

  const listOpacity =
    frame < 90
      ? 1
      : interpolate(frame, [90, 110], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })

  const detailOpacity =
    frame < 90
      ? 0
      : interpolate(frame, [90, 110], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })

  return (
    <AbsoluteFill style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Layer 1: Inspections list */}
      <img
        src="/help/screenshots/inspections-list.png"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: listOpacity,
        }}
      />

      {/* Layer 2: Inspection detail modal */}
      {frame >= 85 && (
        <img
          src="/help/screenshots/inspection-detail.png"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: detailOpacity,
          }}
        />
      )}

      {/* Focus overlays for list phase */}
      {frame < 90 && (
        <FocusOverlay
          areas={[
            // Search bar + filter row
            { start: 0, end: 40, x: 340, y: 80, w: 2185, h: 180 },
            // First inspection card
            { start: 40, end: 90, x: 340, y: 265, w: 2185, h: 70 },
          ]}
        />
      )}

      {/* Focus overlays for detail phase */}
      {frame >= 110 && (
        <FocusOverlay
          areas={[
            // Dialog header (title + badges)
            { start: 110, end: 200, x: 1154, y: 583, w: 445, h: 55 },
            // Due date & assigned to
            { start: 200, end: 280, x: 1154, y: 638, w: 445, h: 126 },
            // Action buttons (Start Inspection, Void)
            { start: 280, end: 380, x: 1154, y: 764, w: 445, h: 92 },
            // Full dialog
            { start: 380, end: 440, x: 1154, y: 583, w: 445, h: 273 },
          ]}
        />
      )}

      <AnimatedCursor
        steps={[
          { frame: 0, x: 900, y: 120 },
          { frame: 15, x: 700, y: 120 },
          { frame: 40, x: 600, y: 300 },
          { frame: 75, x: 600, y: 300, click: true },
          { frame: 110, x: 1377, y: 610 },
          { frame: 200, x: 1377, y: 700 },
          { frame: 280, x: 1300, y: 810 },
          { frame: 320, x: 1300, y: 810, click: true },
          { frame: 380, x: 1377, y: 720 },
        ]}
      />

      <SceneLabel
        steps={[
          { frame: 0, text: "Filter and search your inspections" },
          { frame: 40, text: "Click an inspection card to view details" },
          { frame: 110, text: "Review inspection name, status & frequency" },
          { frame: 200, text: "See due date and assigned inspector" },
          { frame: 280, text: "Start Inspection or Void it" },
          { frame: 380, text: "Full inspection detail view" },
        ]}
      />
    </AbsoluteFill>
  )
}
