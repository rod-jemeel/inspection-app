import { AbsoluteFill } from "remotion"
import { COLORS } from "../theme"

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⌂" },
  { label: "Inspections", icon: "☑", badge: 3 },
  { label: "Binders", icon: "▤" },
  { label: "Logs", icon: "☰" },
  { label: "Users", icon: "♟" },
  { label: "Invites", icon: "✉" },
  { label: "Settings", icon: "⚙" },
]

export function MockupAppShell({
  activeNav = "Dashboard",
  pageTitle = "Dashboard",
  children,
}: {
  activeNav?: string
  pageTitle?: string
  children: React.ReactNode
}) {
  return (
    <AbsoluteFill style={{ background: COLORS.muted }}>
      {/* Sidebar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 130,
          background: COLORS.sidebar,
          display: "flex",
          flexDirection: "column",
          padding: "10px 6px",
          gap: 1,
        }}
      >
        {/* Logo */}
        <div
          style={{
            color: COLORS.sidebarActive,
            fontSize: 14,
            fontWeight: 700,
            padding: "6px 10px",
            marginBottom: 10,
            letterSpacing: 0.5,
          }}
        >
          Summit
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = item.label === activeNav
          return (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 10px",
                borderRadius: 6,
                fontSize: 10,
                color: isActive ? COLORS.sidebarActive : COLORS.sidebarText,
                background: isActive ? "#ffffff15" : "transparent",
                fontWeight: isActive ? 600 : 400,
                position: "relative",
              }}
            >
              <span style={{ fontSize: 10, width: 14, textAlign: "center" }}>
                {item.icon}
              </span>
              {item.label}
              {item.badge && item.badge > 0 && (
                <span
                  style={{
                    position: "absolute",
                    right: 8,
                    fontSize: 8,
                    fontWeight: 700,
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "0 4px",
                    lineHeight: "14px",
                    minWidth: 14,
                    textAlign: "center",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </div>
          )
        })}

        {/* Bottom help link */}
        <div style={{ marginTop: "auto", padding: "5px 10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 10,
              color: COLORS.sidebarText,
            }}
          >
            <span style={{ fontSize: 10 }}>?</span>
            Help
          </div>
        </div>
      </div>

      {/* Main area */}
      <div
        style={{
          position: "absolute",
          left: 130,
          top: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 36,
            background: COLORS.background,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.foreground,
          }}
        >
          {pageTitle}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  )
}
