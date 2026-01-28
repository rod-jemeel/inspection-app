# Design System

## Foundation

| Property | Value |
|----------|-------|
| **Style preset** | `nova` (shadcn/ui) |
| **UI primitives** | `@base-ui/react` (headless) |
| **Styling** | Tailwind CSS v4 + class-variance-authority (cva) |
| **Icons** | Hugeicons (`hugeicons-react`) |
| **Font** | Inter (Google Fonts, `--font-sans`) |
| **Mono font** | Geist Mono (`--font-geist-mono`) |
| **Color space** | OKLCH |
| **Corners** | Default radius (`rounded-md` for inputs/buttons, `rounded-lg` for dialogs, `rounded-xl` for cards) |
| **Component data** | `data-slot` attributes for identification |

---

## Color Tokens (OKLCH)

All colors use CSS variables. **NEVER use raw color values** (no `bg-blue-500`, `text-gray-600`, etc.).

### Light Mode

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `--background` | `oklch(1 0 0)` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | Default text |
| `--card` | `oklch(1 0 0)` | Card backgrounds |
| `--primary` | `oklch(0.488 0.243 264.376)` | Primary actions (indigo) |
| `--primary-foreground` | `oklch(0.97 0.014 254.604)` | Text on primary |
| `--secondary` | `oklch(0.967 0.001 286.375)` | Secondary surfaces |
| `--muted` | `oklch(0.97 0 0)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.556 0 0)` | Muted text |
| `--accent` | `oklch(0.488 0.243 264.376)` | Accent (same as primary) |
| `--destructive` | `oklch(0.58 0.22 27)` | Error/danger |
| `--border` | `oklch(0.922 0 0)` | Borders |
| `--input` | `oklch(0.922 0 0)` | Input borders |
| `--ring` | `oklch(0.708 0 0)` | Focus rings |

### Dark Mode

| Token | OKLCH Value |
|-------|-------------|
| `--background` | `oklch(0.145 0 0)` |
| `--foreground` | `oklch(0.985 0 0)` |
| `--card` | `oklch(0.205 0 0)` |
| `--primary` | `oklch(0.42 0.18 266)` |
| `--muted` | `oklch(0.269 0 0)` |
| `--muted-foreground` | `oklch(0.708 0 0)` |
| `--destructive` | `oklch(0.704 0.191 22.216)` |
| `--border` | `oklch(1 0 0 / 10%)` |
| `--input` | `oklch(1 0 0 / 15%)` |

### Chart Colors

```css
--chart-1: oklch(0.809 0.105 251.813);  /* Lightest */
--chart-2: oklch(0.623 0.214 259.815);
--chart-3: oklch(0.546 0.245 262.881);
--chart-4: oklch(0.488 0.243 264.376);
--chart-5: oklch(0.424 0.199 265.638);  /* Darkest */
```

### Sidebar Colors

Dedicated sidebar tokens are defined for both light and dark modes. Use `sidebar-*` tokens for sidebar-specific styling.

---

## Typography

| Context | Class | Size |
|---------|-------|------|
| Body text | `text-xs/relaxed` | 12px, relaxed line height |
| Card title | `text-sm font-medium` | 14px, medium weight |
| Field legend (label) | `text-xs` | 12px |
| Field legend (legend) | `text-sm` | 14px |
| Small text | `text-xs` | 12px |
| Error text | `text-xs font-normal` | 12px |

### Font weights

- `font-normal` -- body text, descriptions
- `font-medium` -- titles, labels, buttons

### Rules

- Default body text is `text-xs/relaxed` (NOT `text-base`)
- NEVER use `text-lg`, `text-xl`, `text-2xl` in components
- Use `leading-snug` for labels, `leading-normal` for descriptions

---

## Sizing

### Heights

| Size | Class | Pixels |
|------|-------|--------|
| Extra small | `h-6` | 24px |
| Small | `h-7` | 28px |
| **Default** | **`h-8`** | **32px** |
| Large | `h-9` | 36px |

### Icon sizes

| Context | Class | Pixels |
|---------|-------|--------|
| XS buttons | `size-3` | 12px |
| SM buttons | `size-3.5` | 14px |
| **Default** | **`size-4`** | **16px** |
| Standalone | `size-4` to `size-5` | 16-20px |

### Border radius

This project uses the default shadcn Nova radius tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.625rem` (10px) | Base radius |
| `rounded-sm` | `calc(var(--radius) - 4px)` | Small elements |
| `rounded-md` | `calc(var(--radius) - 2px)` | Buttons, inputs, badges |
| `rounded-lg` | `var(--radius)` | Dialogs, popovers |
| `rounded-xl` | `calc(var(--radius) + 4px)` | Cards |

Components use appropriate radius by default - no need to add radius classes manually.

---

## Component Patterns

### Button

```tsx
import { Button } from "@/components/ui/button"

// Variants: default, outline, secondary, ghost, destructive, link
// Sizes: default (h-8), xs (h-6), sm (h-7), lg (h-9), icon, icon-xs, icon-sm, icon-lg

<Button variant="default" size="default">
  <HugeIcon strokeWidth={2} /> Label
</Button>
```

Key classes:
```
rounded-none border border-transparent text-xs font-medium
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1
disabled:pointer-events-none disabled:opacity-50
```

### Input

```tsx
import { Input } from "@/components/ui/input"

<Input type="text" placeholder="Enter value" />
```

Key classes:
```
h-8 rounded-none border bg-transparent px-2.5 py-1 text-xs
dark:bg-input/30 border-input
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
    <CardAction><Button size="sm">Action</Button></CardAction>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

Key classes:
```
ring-foreground/10 bg-card rounded-none py-4 text-xs/relaxed ring-1
```

Supports `size="sm"` for compact cards.

### Badge

```tsx
import { Badge } from "@/components/ui/badge"

// Variants: default, secondary, destructive, outline, ghost, link
<Badge variant="default">Label</Badge>
```

Key classes:
```
h-5 rounded-none border border-transparent px-2 py-0.5 text-xs font-medium
```

### Field (Form Fields)

```tsx
import { Field, FieldLabel, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field"

<FieldGroup>
  <Field>
    <FieldLabel>Label</FieldLabel>
    <Input />
    <FieldDescription>Help text</FieldDescription>
    <FieldError errors={errors} />
  </Field>
</FieldGroup>
```

Supports orientations: `vertical` (default), `horizontal`, `responsive`.

---

## Icons

Use **Lucide** (`lucide-react`). NEVER use Hugeicons or Phosphor.

```tsx
import { CheckSquare, X, Plus, AlertTriangle, ChevronDown } from "lucide-react"

// Icons use default stroke width. Size via className.
<CheckSquare className="size-4" />
<AlertTriangle className="size-4 text-destructive" />
```

### Icon sizing in buttons

Buttons auto-size icons via `[&_svg:not([class*='size-'])]:size-4` (default) or `size-3` (xs), `size-3.5` (sm).

To override, add an explicit `size-*` class.

---

## Focus States

All interactive elements must include focus states:

```
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1
```

### Invalid states

```
aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40
aria-invalid:border-destructive dark:aria-invalid:border-destructive/50
aria-invalid:ring-1
```

---

## Dark Mode

Support via `.dark` class on `<html>` and `dark:` Tailwind variants:

```tsx
// Example
<div className="bg-background dark:bg-background text-foreground" />
<div className="border-input dark:border-input dark:bg-input/30" />
```

All semantic tokens automatically switch between light and dark values.

---

## Patterns

### data-slot Convention

Every component sets `data-slot` for identification and parent-child styling:

```tsx
<div data-slot="card">
  <div data-slot="card-header">
    <div data-slot="card-title">...</div>
  </div>
</div>
```

Parent components use `has-data-[slot=...]` selectors to style conditionally.

### cn() Utility

Always use `cn()` (clsx + tailwind-merge) for className merging:

```tsx
import { cn } from "@/lib/utils"

<div className={cn("base-classes", conditional && "extra-class", className)} />
```

### class-variance-authority (cva)

Use `cva` for variant-based components:

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const myVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", outline: "..." },
    size: { default: "h-8", sm: "h-7" },
  },
  defaultVariants: { variant: "default", size: "default" },
})
```

---

## Anti-Patterns

- **DO NOT** use raw color values (`bg-blue-500`, `text-gray-600`)
- **DO NOT** use `text-base`, `text-lg`, `text-xl` (too large)
- **DO NOT** use Lucide or Phosphor (use Hugeicons only)
- **DO NOT** use `rounded-none` on components (use default radius classes)
- **DO NOT** skip focus states on interactive elements
- **DO NOT** skip `data-slot` attributes on components
- **DO NOT** import from `@base-ui/react` directly in feature code -- use `@/components/ui/*` wrappers

---

## List Page Patterns

### Action Bar

Standard layout for list pages with search and filters:

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
  {/* Search */}
  <div className="relative flex-1">
    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    <Input
      type="search"
      placeholder="Search..."
      className="h-8 pl-8 text-xs"
    />
  </div>

  {/* Filter buttons - grid on mobile, flex on desktop */}
  <div className="grid flex-1 grid-cols-3 gap-1.5 sm:flex sm:flex-none sm:flex-wrap">
    {filters.map((filter) => (
      <button
        className={cn(
          "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        {filter.label}
      </button>
    ))}
  </div>
</div>
```

### Collapsible Sections

Group items with expandable headers:

```tsx
<Collapsible defaultOpen={defaultOpen}>
  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted">
    <ChevronRight className={cn(
      "size-4 text-muted-foreground transition-transform",
      open && "rotate-90"
    )} />
    <span className={cn("text-xs font-medium", headerClassName)}>{title}</span>
    <Badge variant="secondary" className="ml-auto text-[10px]">
      {items.length}
    </Badge>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="grid grid-cols-1 gap-3 pb-4 pt-2 md:grid-cols-2">
      {items.map(renderCard)}
    </div>
  </CollapsibleContent>
</Collapsible>
```

### Tabs (Full-width mobile)

```tsx
<Tabs value={view} onValueChange={setView}>
  <TabsList className="h-8 w-full sm:w-fit">
    <TabsTrigger value="urgency" className="text-xs sm:flex-initial">
      By Urgency
    </TabsTrigger>
    <TabsTrigger value="frequency" className="text-xs sm:flex-initial">
      By Frequency
    </TabsTrigger>
  </TabsList>
  <TabsContent value="urgency">...</TabsContent>
</Tabs>
```

---

## List Item Cards

### Clickable Item Card

Standard pattern for list items (inspections, templates):

```tsx
<button
  className={cn(
    "group flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left shadow-sm transition-all",
    "hover:border-primary/50 hover:shadow-md",
    isInactive && "opacity-60"
  )}
>
  {/* Optional icon indicator */}
  {showIcon && (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10">
      <AlertTriangle className="size-4 text-destructive" />
    </div>
  )}

  {/* Main content */}
  <div className="min-w-0 flex-1">
    <span className="truncate text-xs font-medium">{title}</span>
    <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
      <span>{primaryInfo}</span>
      {secondaryInfo && (
        <>
          <span className="hidden sm:inline">·</span>
          <span className="truncate">{secondaryInfo}</span>
        </>
      )}
    </div>
  </div>

  {/* Badges and arrow */}
  <div className="flex shrink-0 items-center gap-2">
    <Badge variant="outline" className="text-[10px]">{badge}</Badge>
    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
  </div>
</button>
```

### Draggable Card (Templates)

```tsx
<div
  className={cn(
    "group relative flex items-center gap-2 rounded-md border bg-card p-3 shadow-sm transition-shadow",
    isDragging && "shadow-lg ring-2 ring-primary/20",
    canManage && "cursor-pointer hover:border-primary/50 hover:shadow-md"
  )}
>
  {/* Drag handle - hidden until hover on desktop */}
  <button
    data-drag-handle
    className="flex-shrink-0 cursor-grab text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100"
  >
    <GripVertical className="size-4" />
  </button>

  <div className="min-w-0 flex-1">...</div>

  {/* Actions - hidden until hover on desktop */}
  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
    <Button variant="ghost" size="icon-sm" className="text-destructive/70 hover:text-destructive">
      <Trash2 className="size-3.5" />
    </Button>
  </div>
</div>
```

---

## Status & Frequency Badges

### Status Config

```tsx
const statusConfig: Record<string, { variant: string; className?: string }> = {
  pending: { variant: "outline" },
  in_progress: { variant: "secondary" },
  failed: { variant: "destructive" },
  passed: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
  void: { variant: "outline", className: "opacity-50" },
}
```

### Frequency Badges (Colored)

```tsx
const FREQ_CONFIG: Record<string, { label: string; className: string }> = {
  weekly: { label: "Weekly", className: "bg-blue-100 text-blue-700 border-blue-200" },
  monthly: { label: "Monthly", className: "bg-green-100 text-green-700 border-green-200" },
  yearly: { label: "Yearly", className: "bg-amber-100 text-amber-700 border-amber-200" },
  every_3_years: { label: "Every 3 Years", className: "bg-purple-100 text-purple-700 border-purple-200" },
}

<Badge variant="outline" className={cn("text-[10px]", FREQ_CONFIG[freq]?.className)}>
  {FREQ_CONFIG[freq]?.label}
</Badge>
```

---

## Empty States

```tsx
const EmptyState = (
  <div className="py-20 text-center text-xs text-muted-foreground">
    No items found
  </div>
)
```

---

## Signature Patterns

### Fullscreen Signature Pad

Mobile: fullscreen | Desktop: centered modal

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
  <div className="flex h-full w-full flex-col bg-background md:h-[80vh] md:max-h-[600px] md:w-[90vw] md:max-w-2xl md:rounded-lg md:border md:shadow-lg">
    {/* Header */}
    <div className="flex items-center justify-between border-b p-4">
      <h2 className="text-sm font-medium">Sign Inspection</h2>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onUndo}>Undo</Button>
        <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
      </div>
    </div>

    {/* Canvas */}
    <div className="flex-1 p-4">
      <canvas ref={canvasRef} className="size-full border bg-white" />
    </div>

    {/* Footer */}
    <div className="flex gap-2 border-t p-4">
      <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
      <Button className="flex-1" onClick={onSave}>Save Signature</Button>
    </div>
  </div>
</div>
```

### Signature Display

```tsx
<div className="rounded-md border p-4">
  <div className="mb-3 flex items-center gap-2 text-xs">
    <PenTool className="size-4 text-primary" />
    <span className="font-medium">Signed</span>
    <span className="text-muted-foreground">· {formatDate(signedAt)}</span>
  </div>
  <div className="flex justify-center rounded border bg-white p-2">
    <img src={signatureUrl} alt="Signature" className="h-24 max-w-full object-contain" />
  </div>
</div>
```

---

## Modal Patterns

### Detail Modal with Skeleton Loading

```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
    {loading ? (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="sr-only">Loading...</DialogTitle>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    ) : (
      {/* Content */}
    )}
  </DialogContent>
</Dialog>
```
