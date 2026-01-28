"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface UseFitTextOptions {
  minFontSize?: number
  maxFontSize?: number
  maxLines?: number
}

export function useFitText({
  minFontSize = 10,
  maxFontSize = 14,
  maxLines = 2,
}: UseFitTextOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [fontSize, setFontSize] = useState(maxFontSize)
  const [lines, setLines] = useState(1)

  const calculateFit = useCallback(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const containerWidth = container.offsetWidth
    let currentSize = maxFontSize
    let currentLines = 1

    // Reset to measure
    text.style.fontSize = `${currentSize}px`
    text.style.webkitLineClamp = "1"
    text.style.display = "-webkit-box"
    text.style.webkitBoxOrient = "vertical"
    text.style.overflow = "hidden"
    text.style.wordBreak = "break-word"

    // Shrink font until it fits or we hit minimum
    while (text.scrollWidth > containerWidth && currentSize > minFontSize) {
      currentSize -= 0.5
      text.style.fontSize = `${currentSize}px`
    }

    // If still doesn't fit at min size, try 2 lines
    if (text.scrollWidth > containerWidth && currentLines < maxLines) {
      currentLines = 2
      text.style.webkitLineClamp = "2"
      currentSize = maxFontSize

      // Try again with 2 lines, shrinking if needed
      text.style.fontSize = `${currentSize}px`
      while (text.scrollHeight > text.offsetHeight * 2 && currentSize > minFontSize) {
        currentSize -= 0.5
        text.style.fontSize = `${currentSize}px`
      }
    }

    setFontSize(currentSize)
    setLines(currentLines)
  }, [minFontSize, maxFontSize, maxLines])

  useEffect(() => {
    calculateFit()

    const resizeObserver = new ResizeObserver(calculateFit)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [calculateFit])

  return {
    containerRef,
    textRef,
    fontSize,
    lines,
    style: {
      fontSize: `${fontSize}px`,
      WebkitLineClamp: lines,
      display: "-webkit-box",
      WebkitBoxOrient: "vertical" as const,
      overflow: "hidden",
      wordBreak: "break-word" as const,
    },
  }
}
