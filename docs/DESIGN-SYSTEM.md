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

## Inspection-Specific UI Patterns

### Status Badges

```tsx
const statusVariant: Record<string, string> = {
  pending: "outline",
  in_progress: "secondary",
  passed: "default",    // primary color
  failed: "destructive",
  void: "ghost",
}

<Badge variant={statusVariant[status]}>{status}</Badge>
```

### Signature Canvas

Use `signature_pad` on a `<canvas>` element within a Card:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Signature</CardTitle>
  </CardHeader>
  <CardContent>
    <canvas
      ref={canvasRef}
      className="border-input h-40 w-full border bg-white"
    />
  </CardContent>
  <CardFooter>
    <Button variant="ghost" size="sm" onClick={clearSignature}>Clear</Button>
    <Button size="sm" onClick={submitSignature}>Sign & Submit</Button>
  </CardFooter>
</Card>
```

### Inspection Instance Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>{instance.task}</CardTitle>
    <CardDescription>Due: {formatDate(instance.due_at)}</CardDescription>
    <CardAction>
      <Badge variant={statusVariant[instance.status]}>{instance.status}</Badge>
    </CardAction>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">{instance.remarks}</p>
  </CardContent>
</Card>
```
