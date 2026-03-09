"use client"

import * as React from "react"

export interface PageBreadcrumbItem {
  href?: string
  label: string
}

interface PageBreadcrumbContextValue {
  items: PageBreadcrumbItem[] | null
  setItems: React.Dispatch<React.SetStateAction<PageBreadcrumbItem[] | null>>
}

const PageBreadcrumbContext = React.createContext<PageBreadcrumbContextValue | null>(null)

export function PageBreadcrumbProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [items, setItems] = React.useState<PageBreadcrumbItem[] | null>(null)

  const value = React.useMemo(
    () => ({
      items,
      setItems,
    }),
    [items]
  )

  return (
    <PageBreadcrumbContext.Provider value={value}>
      {children}
    </PageBreadcrumbContext.Provider>
  )
}

export function usePageBreadcrumbs() {
  const context = React.useContext(PageBreadcrumbContext)
  if (!context) {
    throw new Error("usePageBreadcrumbs must be used within a PageBreadcrumbProvider.")
  }

  return context
}

export function PageBreadcrumbs({
  items,
}: {
  items: PageBreadcrumbItem[]
}) {
  const { setItems } = usePageBreadcrumbs()

  React.useEffect(() => {
    setItems(items)
    return () => setItems(null)
  }, [items, setItems])

  return null
}
