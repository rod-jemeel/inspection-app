import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import { COLORS, SPRING_SMOOTH } from "../theme"
import { AnimatedCursor } from "../scenes/animated-cursor"
import { SceneLabel } from "../scenes/scene-label"
import { FocusOverlay } from "../scenes/focus-overlay"

export const SigningInspection = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Phase 1: Inspection detail - highlight Fill Form button (0-120)
  // Phase 2: Show signature concept overlay (120-350)
  // Phase 3: Success state (350-450)

  const signatureOverlayOpacity =
    frame < 120
      ? 0
      : frame < 350
        ? interpolate(frame, [120, 140], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : interpolate(frame, [350, 370], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })

  const successOpacity =
    frame >= 350
      ? interpolate(frame, [350, 370], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0

  const successScale =
    frame >= 360
      ? spring({ frame: frame - 360, fps, config: { damping: 12 } })
      : 0

  const sigProgress =
    frame >= 160
      ? interpolate(frame, [160, 300], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0

  return (
    <AbsoluteFill style={{ fontFamily: "system-ui, sans-serif" }}>
      <img
        src="/help/screenshots/inspection-detail.png"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {frame < 120 && (
        <FocusOverlay
          areas={[
            // Dialog container
            { start: 0, end: 60, x: 1154, y: 583, w: 445, h: 273 },
            // Start Inspection button area
            { start: 60, end: 120, x: 1154, y: 764, w: 230, h: 50 },
          ]}
        />
      )}

      {/* Signature modal overlay */}
      {signatureOverlayOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: signatureOverlayOpacity,
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: 520,
              background: COLORS.background,
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: `1px solid ${COLORS.border}`,
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.foreground,
              }}
            >
              Sign Inspection
            </div>
            <div style={{ padding: 24 }}>
              <div
                style={{
                  fontSize: 15,
                  color: COLORS.mutedForeground,
                  marginBottom: 12,
                }}
              >
                Draw your signature below
              </div>
              <div
                style={{
                  width: "100%",
                  height: 140,
                  background: "#fafbfc",
                  border: `1.5px dashed ${COLORS.border}`,
                  borderRadius: 8,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 472 140"
                  style={{ position: "absolute", inset: 0 }}
                >
                  <path
                    d="M 30 65 C 50 30, 70 30, 80 55 C 90 75, 100 75, 110 50 C 120 25, 140 25, 150 55 C 160 80, 175 45, 190 40 C 210 35, 220 60, 240 55 C 255 50, 260 45, 270 50"
                    fill="none"
                    stroke={COLORS.foreground}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="400"
                    strokeDashoffset={interpolate(sigProgress, [0, 1], [400, 0])}
                  />
                </svg>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                <div
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    fontSize: 15,
                    fontWeight: 500,
                    textAlign: "center",
                    color: COLORS.mutedForeground,
                  }}
                >
                  Clear
                </div>
                <div
                  style={{
                    flex: 2,
                    padding: "12px 0",
                    borderRadius: 8,
                    background: COLORS.primary,
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 600,
                    textAlign: "center",
                    transform:
                      frame >= 330 && frame < 345 ? "scale(0.96)" : "scale(1)",
                  }}
                >
                  Complete & Sign
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success overlay */}
      {successOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: successOpacity,
            zIndex: 25,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              transform: `scale(${successScale})`,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                color: "#fff",
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
              Inspection Signed!
            </div>
          </div>
        </div>
      )}

      <AnimatedCursor
        steps={[
          { frame: 0, x: 1377, y: 700 },
          { frame: 30, x: 1377, y: 620 },
          { frame: 60, x: 1250, y: 810 },
          { frame: 100, x: 1250, y: 810, click: true },
          { frame: 140, x: 1377, y: 720 },
          { frame: 160, x: 1300, y: 700 },
          { frame: 220, x: 1450, y: 730 },
          { frame: 280, x: 1550, y: 710 },
          { frame: 330, x: 1480, y: 790, click: true },
          { frame: 370, x: 1500, y: 750 },
        ]}
      />

      <SceneLabel
        steps={[
          { frame: 0, text: "Open an inspection to review details" },
          { frame: 60, text: "Click 'Fill Form' to start the inspection" },
          { frame: 120, text: "Draw your signature on the canvas" },
          { frame: 300, text: "Click 'Complete & Sign' to finish" },
          { frame: 350, text: "Inspection signed successfully!" },
        ]}
      />
    </AbsoluteFill>
  )
}
