"use client"

import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: { container: "h-6 w-12", shape: "h-2 w-2" },
    md: { container: "h-8 w-16", shape: "h-2.5 w-2.5" },
    lg: { container: "h-10 w-20", shape: "h-3 w-3" },
  }

  const s = sizeMap[size]

  return (
    <div className={cn("flex items-center justify-center gap-1.5", s.container, className)} role="status" aria-label="Loading">
      <style>{`
        @keyframes morph-1 {
          0%, 100% { border-radius: 0; transform: scale(1) rotate(0deg); opacity: 0.5; }
          25% { border-radius: 50%; transform: scale(1.3) rotate(90deg); opacity: 1; }
          50% { border-radius: 30%; transform: scale(0.8) rotate(180deg); opacity: 0.7; }
          75% { border-radius: 50%; transform: scale(1.2) rotate(270deg); opacity: 0.9; }
        }
        @keyframes morph-2 {
          0%, 100% { border-radius: 50%; transform: scale(1.2) rotate(0deg); opacity: 0.9; }
          25% { border-radius: 0; transform: scale(0.8) rotate(-90deg); opacity: 0.5; }
          50% { border-radius: 50%; transform: scale(1.3) rotate(-180deg); opacity: 1; }
          75% { border-radius: 20%; transform: scale(1) rotate(-270deg); opacity: 0.7; }
        }
        @keyframes morph-3 {
          0%, 100% { border-radius: 30%; transform: scale(0.8) rotate(0deg); opacity: 0.7; }
          25% { border-radius: 50%; transform: scale(1) rotate(120deg); opacity: 0.9; }
          50% { border-radius: 0; transform: scale(1.3) rotate(240deg); opacity: 0.5; }
          75% { border-radius: 50%; transform: scale(0.9) rotate(360deg); opacity: 1; }
        }
      `}</style>
      <div
        className={cn(s.shape, "bg-primary")}
        style={{ animation: "morph-1 1.8s ease-in-out infinite" }}
      />
      <div
        className={cn(s.shape, "bg-primary")}
        style={{ animation: "morph-2 1.8s ease-in-out infinite 0.2s" }}
      />
      <div
        className={cn(s.shape, "bg-primary")}
        style={{ animation: "morph-3 1.8s ease-in-out infinite 0.4s" }}
      />
    </div>
  )
}
