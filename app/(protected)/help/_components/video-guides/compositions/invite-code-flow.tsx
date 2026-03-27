import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import { COLORS, SPRING_SMOOTH } from "../theme"
import { AnimatedCursor } from "../scenes/animated-cursor"
import { SceneLabel } from "../scenes/scene-label"
import { FocusOverlay } from "../scenes/focus-overlay"

export const InviteCodeFlow = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Phase 1: Team/Invites page - admin view (0-140)
  // Phase 2: Crossfade to invite code entry (140-170)
  // Phase 3: Invite code entry - inspector view (170-450)

  const phase1Opacity =
    frame < 140
      ? 1
      : interpolate(frame, [140, 170], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })

  const phase2Opacity =
    frame < 140
      ? 0
      : frame < 300
        ? interpolate(frame, [140, 170], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 1

  // Phase labels
  const adminLabelOpacity =
    frame < 130
      ? interpolate(frame, [0, 15], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(frame, [130, 145], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })

  const inspectorLabelOpacity =
    frame >= 170
      ? interpolate(frame, [170, 185], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0

  return (
    <AbsoluteFill style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Layer 1: Admin view - invites page */}
      <img
        src="/help/screenshots/invites-page.png"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: phase1Opacity,
        }}
      />

      {/* Layer 2: Inspector view - invite code entry */}
      {frame >= 135 && (
        <img
          src="/help/screenshots/invite-code-entry.png"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: phase2Opacity,
          }}
        />
      )}

      {/* Admin view focus overlays */}
      {frame < 140 && (
        <FocusOverlay
          areas={[
            // Invites tab button
            { start: 0, end: 40, x: 480, y: 88, w: 80, h: 35 },
            // Add button
            { start: 40, end: 90, x: 2300, y: 88, w: 80, h: 35 },
            // Invites table section
            { start: 90, end: 140, x: 340, y: 143, w: 2200, h: 100 },
          ]}
        />
      )}

      {/* Inspector view focus overlays */}
      {frame >= 170 && (
        <FocusOverlay
          areas={[
            // Invite code input field
            { start: 200, end: 300, x: 960, y: 548, w: 640, h: 156 },
            // Name field
            { start: 300, end: 370, x: 960, y: 748, w: 640, h: 60 },
            // Enter button
            { start: 370, end: 430, x: 953, y: 873, w: 653, h: 43 },
          ]}
        />
      )}

      {/* Admin View / Inspector View badges */}
      {adminLabelOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            padding: "8px 18px",
            borderRadius: 8,
            background: COLORS.primary,
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
            opacity: adminLabelOpacity,
            zIndex: 30,
          }}
        >
          Admin View
        </div>
      )}
      {inspectorLabelOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            padding: "8px 18px",
            borderRadius: 8,
            background: "#22c55e",
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
            opacity: inspectorLabelOpacity,
            zIndex: 30,
          }}
        >
          Inspector View
        </div>
      )}

      <AnimatedCursor
        steps={[
          { frame: 0, x: 520, y: 100 },
          { frame: 10, x: 520, y: 100 },
          { frame: 40, x: 2340, y: 105 },
          { frame: 75, x: 2340, y: 105, click: true },
          { frame: 90, x: 1100, y: 180 },
          { frame: 140, x: 1100, y: 200 },
          // Inspector phase
          { frame: 200, x: 1280, y: 630 },
          { frame: 250, x: 1280, y: 630, click: true },
          { frame: 300, x: 1280, y: 780 },
          { frame: 340, x: 1280, y: 780, click: true },
          { frame: 370, x: 1280, y: 895 },
          { frame: 410, x: 1280, y: 895, click: true },
        ]}
      />

      <SceneLabel
        steps={[
          { frame: 0, text: "Admin: Go to Team > Invites tab" },
          { frame: 40, text: "Click 'Add' to generate a new invite" },
          { frame: 90, text: "Share the invite code with your inspector" },
          { frame: 170, text: "Inspector: Enter the invite code" },
          { frame: 300, text: "Optionally enter your name" },
          { frame: 370, text: "Click 'Enter' to join the organization" },
        ]}
      />
    </AbsoluteFill>
  )
}
