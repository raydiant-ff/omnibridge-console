# Omni UI Foundation

> Single source of truth for typography, theme tokens, page archetypes, component usage,
> and design rules in the OmniBridge console. Every UI decision should trace back here.

---

## 1. Typography

### Font stack

| Role | Family | CSS variable | Usage |
|------|--------|-------------|-------|
| Sans (primary) | **Geist Sans** | `--font-geist-sans` | All interface text |
| Mono | **Geist Mono** | `--font-geist-mono` | Code, IDs, amounts, timestamps, terminal output |

Loaded in `layout.tsx` via `geist/font/sans` and `geist/font/mono`. Tailwind resolves through:

```css
--font-sans: var(--font-geist-sans), system-ui, sans-serif;
--font-mono: var(--font-geist-mono), ui-monospace, monospace;
```

No serif font is used. Do not introduce one without deliberate approval.

### Type scale rules

| Surface | Weight | Size | Tracking | Example |
|---------|--------|------|----------|---------|
| App shell / nav labels | Medium (500) | `text-xs` | Normal | Sidebar section headers |
| Page title | Semibold (600) | `text-xl` or `text-2xl` | Tight (`tracking-tight`) | "Renewals", "Subscriptions" |
| Section header | Medium (500) | `text-base` or `text-lg` | Normal | Card titles, tab labels |
| Table header | Medium (500) | `text-xs` | Wide (`uppercase tracking-wider`) | Column heads |
| Primary metric | Semibold (600) | `text-2xl` or `text-3xl` | Tight | KPI strip numbers |
| Secondary metadata | Regular (400) | `text-sm` | Normal | Timestamps, helper text |
| Status / help text | Regular (400) | `text-xs` | Normal | Badges, tooltips, empty states |

### Principles

- **Scanability over novelty.** Users are often low-tech — hierarchy must be immediately obvious.
- **Confidence over cleverness.** Bold page titles, clear section breaks, explicit labels.
- **One family.** Geist Sans for everything except monospaced contexts (amounts, IDs, code).

---

## 2. Theme tokens

### Identity: white / clear operational workspace

The light theme is the **primary** Omni identity, not a fallback. Dark mode exists as a secondary option.

### Light theme (`:root` in `globals.css`)

```css
/* Surfaces */
--background: #ffffff        /* Page background — pure white */
--card: #ffffff              /* Cards, panels — same white, distinguished by border */
--secondary: #f8f8f8         /* Subtle tint for hover, alternate rows, inactive tabs */
--muted: #f5f5f5             /* Stronger tint for disabled, skeleton, grouped backgrounds */

/* Text */
--foreground: #171717        /* Primary text — near-black */
--secondary-foreground: #282828
--muted-foreground: #6b6b6b  /* Secondary text — high enough contrast on white */

/* Accent */
--primary: #0047d4           /* Omni blue — CTAs, active nav, links */
--ring: #4270eb              /* Focus outlines */

/* Semantic */
--destructive: #e5393b       /* Errors, cancel actions */
--success: #15943f           /* Confirmed, active, healthy */
--warning: #e8501e           /* Needs attention, at risk */

/* Borders */
--border: #e8e8e8            /* Default border — soft on white */
--input: #e8e8e8             /* Input borders */

/* Radius */
--radius: 0.5rem             /* Default (8px) */
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
```

### Design qualities

- **White but not sterile.** Cards use `border` for definition, not background contrast.
- **Clear but not washed out.** Semantic colors are saturated enough to read instantly.
- **Operational density without visual mud.** Tight spacing, clear borders, no decorative shadows.
- **High contrast for low-tech users.** Text meets WCAG AA on all surfaces.

### Dark theme

OKLCH-based deep indigo/blue palette defined in `.dark {}`. Secondary to the light theme.
Keep in sync when adding new tokens, but do not lead design decisions from dark mode.

---

## 3. Page archetypes

Every page in Omni must map to one of these four archetypes. Do not introduce new archetypes without deliberate approval.

### A. Workspace Dashboard

Summary header with KPI strip, priority lanes or grouped sections, drill-in cards or queue snippets.

**Used for:** CS Renewals dashboard, main landing pages.

**Structure:**
```
WorkspaceHeader → page title + subtitle + action buttons
  KPI strip → 3–6 stat cards in a row
WorkspaceBody
  SectionStack → priority-grouped content lanes
```

### B. Queue / List-Detail

Table-first layout. Filters at top. Optional right detail panel or bottom expand.

**Used for:** Subscriptions list, customer search, queue pages.

**Structure:**
```
WorkspaceHeader → page title + filter bar
WorkspaceBody
  Table (primary) + optional StickyRail or expand-row detail
```

### C. Record / Account Detail

Summary header with key identifiers, tabbed or sectional detail, related workflow links.

**Used for:** Customer detail, opportunity detail, quote detail.

**Structure:**
```
WorkspaceHeader → record identity + status badge + actions
WorkspaceBody
  DetailTabsRegion → tabbed content sections
    or SectionStack → linear sections
```

### D. Data / Investigation Surface

Dense, focused, minimal chrome. Table or analysis oriented.

**Used for:** Reports, data quality, scrub views, reconciliation scripts.

**Structure:**
```
WorkspaceHeader → minimal title + date range or filter
WorkspaceBody
  Full-width table or data grid, maximum density
```

---

## 4. Block import policy

shadcn/ui blocks and third-party registries (`@shadcnuikit`, `@v0`, etc.) are accelerators, not final UI.

### Rules

1. **Import only when a block matches an approved archetype.** No random card-masonry layouts.
2. **Normalize immediately.** Replace block colors, spacing, and typography with Omni tokens on import.
3. **Strip ad hoc styling.** Remove one-off gradients, custom shadows, or brand colors from the source.
4. **Extract local primitives.** If a block pattern repeats, extract it into `components/shell/` or `components/ui/`.
5. **No block gallery aesthetic.** Omni should feel like one product, not a collection of pasted blocks.

### Registered block sources

Defined in `components.json` → `registries`:
- `@shadcnuikit`, `@shadcn-dashboard`, `@tailwind-admin`, `@ui-layouts`, `@shadcnui-blocks`

---

## 5. Explicitness and accessibility rules

For low-tech users, ambiguity is expensive. These rules are baked into the foundation:

| Rule | Rationale |
|------|-----------|
| Labels should be explicit, not shorthand-heavy | "Monthly Recurring Revenue" not "MRR" on first encounter |
| Destructive vs safe actions must be unmistakable | Red button + confirmation dialog for destructive, blue for safe |
| Empty states must explain what the page is for | "No renewals due this month" not just a blank table |
| Filters must show active state clearly | Badge count or highlighted chip when filter is applied |
| Side sheets / detail panels should summarize "why this matters" | Lead with context, not just raw data |
| Status colors are never the only signal | Always pair color with text label or icon |
| Tables must have strong header contrast and obvious hover states | `uppercase tracking-wider text-xs font-medium` headers, `hover:bg-muted` rows |

---

## 6. Operational data-viz rules

Charts and visual metrics support operational understanding — they are not decoration.

| Rule | Rationale |
|------|-----------|
| Queues and tables remain primary for operational work | Users act on rows, not chart segments |
| Charts are supportive, not dominant | Max one chart section per workspace dashboard |
| Dashboard visuals must lead into action | Every metric should link or drill into the relevant queue/table |
| Trend views use restrained color semantics | Match `--chart-1` through `--chart-5`, no rainbow palettes |
| No decorative charts without next-step meaning | If you can't click through to act on it, don't show it |

---

## 7. Shell primitives reference

### App-level (`components/shell/app-shell.tsx`)

| Primitive | Purpose |
|-----------|---------|
| `AppShell` | Root container: sidebar + top-bar + main content |
| `SidebarShell` | Collapsible sidebar (260px / 60px) |
| `SidebarNavSection` | Labeled nav group |
| `SidebarFooter` | Pinned bottom region |
| `TopBar` | Sticky application header (h-14) |

### Workspace-level (`components/shell/workspace.tsx`)

| Primitive | Purpose |
|-----------|---------|
| `WorkspaceContainer` | Page-level wrapper (full / contained / narrow) |
| `WorkspaceHeader` | Sticky page header region (px-8 pt-8 pb-6) |
| `WorkspaceBody` | Scrollable main content (px-8 pb-8 gap-6) |
| `PrimaryColumn` | Flexible main column (flex-1) |
| `SecondaryColumn` | Fixed secondary column (w-80) |
| `TertiaryColumn` | Narrow auxiliary column (w-64) |
| `StickyRail` | Fixed right-side auxiliary rail (w-72) |
| `SectionStack` | Vertical section sequence (gap sm/md/lg) |
| `SectionBlock` | Individual section unit |
| `DetailTabsRegion` | Tab system wrapper for record detail |
| `OverlayContainer` | Portal-ready mount point for overlays (z-50) |

---

## 8. shadcn/ui project setup

### `components.json` config

| Setting | Value |
|---------|-------|
| Style | `new-york` |
| Base color | `neutral` |
| CSS variables | enabled |
| Icons | `lucide-react` |
| RSC | enabled |
| CSS file | `src/app/globals.css` |

**Path aliases:**
```
@/components/ui  → ui components
@/lib/utils      → cn helper
@/components     → all components
@/lib            → lib
@/hooks          → hooks
```

**CLI (always pass `--cwd` in monorepo):**
```bash
pnpm dlx shadcn@latest add <component> --cwd apps/console
pnpm dlx shadcn@latest add @v0/<block> --cwd apps/console
pnpm dlx shadcn@latest view <component> --cwd apps/console
pnpm dlx shadcn@latest search @v0 -q "<keyword>"
pnpm dlx shadcn@latest init -f --cwd apps/console   # force re-init
```

### Installed components (`src/components/ui/`)

| Component | Notes |
|-----------|-------|
| `avatar` | Standard |
| `badge` | 9 variants: default, secondary, destructive, outline, ghost, link, success, warning, info |
| `button` | 6 variants x 7 sizes (xs, sm, default, lg, icon, icon-xs, icon-sm, icon-lg) |
| `card` | Subcomponents: Header, Title, Description, Action, Content, Footer |
| `checkbox` | Standard |
| `dialog` | Standard |
| `dry-run-log-panel` | Custom (not standard shadcn) |
| `input` | Customized |
| `label` | Standard |
| `radio-group` | Standard |
| `select` | Standard |
| `separator` | Standard |
| `skeleton` | Standard |
| `switch` | Standard |
| `table` | Subcomponents: Header, Body, Footer, Row, Head, Cell, Caption |
| `tabs` | Standard |

### Key patterns

- **CVA** for all variant components — export both component and variant helper (`buttonVariants`, `badgeVariants`)
- **`data-slot`** attributes on every component for external CSS targeting
- **`asChild`** via `@radix-ui/react-slot` for flexible composition
- **`cn()`** helper from `@/lib/utils` (clsx + tailwind-merge) — always use for class merging
- **Tailwind v4** — no `tailwind.config.ts`; uses `@theme inline`, `@custom-variant dark`, `@layer base`
- Components are **copied into the repo** — own and modify freely

### Custom CSS utilities

```css
.card-shadow               /* 6-layer soft shadow for elevated cards */
.animate-fade-in / .animate-slide-up / .animate-scale-in
.stagger-1 ... .stagger-4  /* animation delay helpers (50ms increments) */
```

### Dependencies

```json
"class-variance-authority": "^0.7",
"clsx": "^2",
"lucide-react": "^0.474",
"radix-ui": "^1.4.3",
"@radix-ui/react-slot": "^1",
"tailwind-merge": "^3",
"tailwindcss": "^4",
"geist": "^1.7"
```
