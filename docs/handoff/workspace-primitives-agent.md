# Workspace Primitives & Page Migration — Agent Handoff

Changes made by the parallel agent during the contracts mirror / admin sync redesign session.

---

## 1. Workspace Design System (`components/workspace/`)

10 reusable primitives extracted from repeated patterns across list and detail pages.

| Component | Props | Purpose |
|---|---|---|
| `PageHeader` | `title, description, badge?, actions?` | Top-of-page header with optional badge and action buttons |
| `Breadcrumb` | `items: {label, href?}[]` | Breadcrumb nav trail |
| `Toolbar` | `children` | Horizontal filter bar wrapper |
| `Section` | `title, children` | Labeled card section for detail grids |
| `StatCard` | `label, value` | Compact metric card for overview rows |
| `TableShell` | `title, description, children` | Card wrapper around data tables |
| `EmptyState` | `title, description?` | Placeholder for empty tables/lists |
| `DetailGrid` | `columns, children` | Responsive CSS grid for detail sections |
| `FieldRow` | `label, value, mono?` | Label/value row inside a Section |
| `index.ts` | — | Barrel export |

**Location:** `apps/console/src/components/workspace/`

---

## 2. Pages Migrated to Workspace Primitives

### List pages
- `customers/page.tsx` — PageHeader, StatCard, Toolbar, TableShell, EmptyState
- `products/page.tsx` — PageHeader, StatCard, Toolbar, TableShell, EmptyState
- `coupons/page.tsx` — PageHeader, Toolbar, TableShell, EmptyState
- `contracts/page.tsx` — PageHeader, StatCard, Toolbar, TableShell, EmptyState (new page)

### Detail pages
- `customers/[id]/page.tsx` — Breadcrumb, PageHeader, DetailGrid, Section, FieldRow
- `cs/renewals/[candidateId]/page.tsx` — Breadcrumb, PageHeader, DetailGrid, Section, FieldRow
- `quotes/[id]/quote-detail.tsx` — Breadcrumb, PageHeader (partial)
- `contracts/[id]/page.tsx` — Breadcrumb, PageHeader, DetailGrid, Section, FieldRow, TableShell, EmptyState (new page)

### Dashboards
- `cs/renewals/renewals-dashboard.tsx` — Toolbar, EmptyState

---

## 3. MRR/ARR Computation Fix

**Problem:** `SfContract.mrr` and `SfContract.arr` (mapped from `Contract_MRR__c` / `Contract_ARR__c`) are always 0 in Salesforce. Real values live on `SfContractLine.mrr` (from `Monthly_Value__c`) and `SfContractLine.arr` (from `ARR__c`).

**Fix in `queries/sf-contracts.ts`:** All three query functions (`getContracts`, `getContractDetail`, `getExpiringContracts`) now:
1. Include `lines: { select: { mrr: true, arr: true } }` in the Prisma query
2. Sum line-level MRR/ARR via `.reduce()`
3. Prefer contract-level value if > 0, otherwise fall back to line sum

```ts
const lineMrr = c.lines.reduce((sum, l) => sum + (l.mrr ?? 0), 0);
const mrr = (c.mrr && c.mrr > 0) ? c.mrr : lineMrr > 0 ? lineMrr : null;
```

---

## 4. `getContractCounts()` Addition

**Problem:** Stat cards on `/contracts` showed counts from query results capped by `take: 200`.

**Fix:** Added `getContractCounts()` function that runs 5 parallel `prisma.sfContract.count()` calls (total, activated, canceled, pending, draft). Page calls both `getContracts()` and `getContractCounts()` via `Promise.all`.

---

## 5. Suspense Boundary Fix

**File:** `cs/renewals/drafts/new/page.tsx`

**Problem:** `useSearchParams()` used without a Suspense boundary — Next.js 15 requires it.

**Fix:** Extracted inner content to `NewDraftInner` client component, wrapped in `<Suspense fallback={...}>` in the page.

---

## 6. Layout Padding Change

**File:** `(app)/layout.tsx`

Changed main content padding from `px-8 py-8` to `px-6 py-6` for tighter spacing.

---

## 7. Sidebar Nav

Added "Contracts" nav item with `FileCheck2` icon, positioned between Quotes and Products in `components/sidebar.tsx`.
