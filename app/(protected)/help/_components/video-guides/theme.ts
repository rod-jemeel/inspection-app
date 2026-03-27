// Brand colors (hardcoded for Remotion predictability — no CSS vars)
export const COLORS = {
  primary: "#5f97cf",
  primaryLight: "#5f97cf22",
  cream: "#f1e9b0",
  coral: "#e6a080",
  sidebar: "#163149",
  sidebarText: "#94a3b8",
  sidebarActive: "#ffffff",
  foreground: "#1f3447",
  background: "#ffffff",
  muted: "#f1f5f9",
  mutedForeground: "#64748b",
  border: "#e2e8f0",
  green: "#22c55e",
  greenLight: "#22c55e22",
  amber: "#f59e0b",
  amberLight: "#f59e0b22",
  red: "#ef4444",
  blue: "#3b82f6",
  blueLight: "#3b82f622",
} as const

// Composition specs
export const COMP_WIDTH = 2560
export const COMP_HEIGHT = 1440
export const COMP_FPS = 30
export const COMP_DURATION = 450 // 15 seconds at 30fps

// Animation presets
export const SPRING_SMOOTH = { damping: 200 } as const
export const SPRING_SNAPPY = { damping: 20, stiffness: 200 } as const
