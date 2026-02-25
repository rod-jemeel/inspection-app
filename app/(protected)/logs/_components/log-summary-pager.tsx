"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface LogSummaryPagerProps {
  total: number
  limit: number
  offset: number
  onOffsetChange: (offset: number) => void
  className?: string
}

function pageItems(current: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set<number>([1, totalPages, current - 1, current, current + 1])
  return Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)
}

export function LogSummaryPager({
  total,
  limit,
  offset,
  onOffsetChange,
  className,
}: LogSummaryPagerProps) {
  const safeLimit = Math.max(1, limit)
  const totalPages = Math.max(1, Math.ceil(total / safeLimit))
  const currentPage = Math.min(totalPages, Math.floor(offset / safeLimit) + 1)

  if (total <= safeLimit) return null

  const items = pageItems(currentPage, totalPages)
  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={!canPrev}
            className={!canPrev ? "pointer-events-none opacity-50" : undefined}
            onClick={(e) => {
              e.preventDefault()
              if (!canPrev) return
              onOffsetChange((currentPage - 2) * safeLimit)
            }}
          />
        </PaginationItem>

        {items.map((page, index) => {
          const prev = items[index - 1]
          const showGap = typeof prev === "number" && page - prev > 1
          return (
            <PaginationItem key={page}>
              {showGap && <PaginationEllipsis />}
              <PaginationLink
                href="#"
                isActive={page === currentPage}
                onClick={(e) => {
                  e.preventDefault()
                  onOffsetChange((page - 1) * safeLimit)
                }}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        })}

        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={!canNext}
            className={!canNext ? "pointer-events-none opacity-50" : undefined}
            onClick={(e) => {
              e.preventDefault()
              if (!canNext) return
              onOffsetChange(currentPage * safeLimit)
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
