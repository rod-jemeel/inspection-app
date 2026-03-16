"use client"

import Image from "next/image"

import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeMap = {
  sm: {
    frame: "size-14",
    shell: "size-11 rounded-[1.35rem] p-1.5",
    logo: "size-[1.65rem]",
  },
  md: {
    frame: "size-18",
    shell: "size-14 rounded-[1.65rem] p-2",
    logo: "size-[2.1rem]",
  },
  lg: {
    frame: "size-24",
    shell: "size-[4.5rem] rounded-[1.9rem] p-2.5",
    logo: "size-[2.55rem]",
  },
} as const

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const styles = sizeMap[size]

  return (
    <div
      className={cn("inline-flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-label="Loading"
      aria-live="polite"
    >
      <style>{`
        @keyframes summit-loader-rise {
          0%, 100% { transform: translateY(0) scale(0.98); }
          50% { transform: translateY(-4px) scale(1.02); }
        }

        @keyframes summit-loader-glow {
          0% { transform: scale(0.86); opacity: 0.2; }
          60% { transform: scale(1.2); opacity: 0; }
          100% { transform: scale(1.2); opacity: 0; }
        }

        @keyframes summit-loader-sheen {
          0% { transform: translateX(-140%) rotate(18deg); opacity: 0; }
          24% { opacity: 0; }
          40% { opacity: 0.52; }
          60% { opacity: 0; }
          100% { transform: translateX(160%) rotate(18deg); opacity: 0; }
        }

        @keyframes summit-loader-shadow {
          0%, 100% { transform: scaleX(0.88); opacity: 0.18; }
          50% { transform: scaleX(1); opacity: 0.1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .summit-loader-rise,
          .summit-loader-glow,
          .summit-loader-sheen,
          .summit-loader-shadow {
            animation: none !important;
          }
        }
      `}</style>

      <div className={cn("relative flex items-center justify-center", styles.frame)}>
        <span
          className="summit-loader-glow absolute inset-0 rounded-full border border-[rgba(95,151,207,0.28)]"
          style={{ animation: "summit-loader-glow 2.1s cubic-bezier(0.22, 1, 0.36, 1) infinite" }}
        />
        <span
          className="summit-loader-glow absolute inset-[10%] rounded-full border border-[rgba(230,160,128,0.24)]"
          style={{ animation: "summit-loader-glow 2.1s cubic-bezier(0.22, 1, 0.36, 1) infinite 0.45s" }}
        />
        <span
          className="summit-loader-shadow absolute bottom-1 h-3 w-[64%] rounded-full bg-[radial-gradient(circle,rgba(31,52,71,0.18),rgba(31,52,71,0))]"
          style={{ animation: "summit-loader-shadow 1.8s ease-in-out infinite" }}
        />

        <div
          className={cn(
            "summit-loader-rise relative flex items-center justify-center overflow-hidden border border-border/80 bg-white shadow-[0_22px_50px_-26px_rgba(20,41,61,0.45)]",
            styles.shell
          )}
          style={{ animation: "summit-loader-rise 1.8s ease-in-out infinite" }}
        >
          <span
            className="summit-loader-sheen pointer-events-none absolute inset-y-[-30%] left-[-55%] w-[42%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.88),transparent)]"
            style={{ animation: "summit-loader-sheen 2.4s ease-in-out infinite" }}
          />
          <Image
            src="/summit-logo.svg"
            alt="Summit logo"
            width={96}
            height={96}
            priority
            className={cn("relative z-10 object-contain", styles.logo)}
          />
        </div>
      </div>
    </div>
  )
}
