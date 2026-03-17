# Omni UI Foundation — Structural Spec

> Source of truth for the Omni base element system and app skeleton.
> This is a skeleton-first build. No final styling, branding, or visual decisions in this phase.

## Philosophy

Omni is a **workspace application**, not a dashboard.

Think in: app shell / workspace shell / page header regions / content regions / side rails / detail surfaces / data regions / action regions / overlays / dense operational tables / layered drill-in surfaces.

Do NOT think in: random KPI cards / chart-first composition / unstructured card masonry / marketing-site sections.

## Component directories

| Directory | Purpose |
|---|---|
| `src/components/shell/` | AppShell, SidebarShell, TopBar, WorkspaceContainer, WorkspaceBody, columns, StickyRail, SectionStack, etc. |
| `src/components/layout/` | PageViewport, PageHeader, PageHeaderMeta, PageActions, PageSection, SplitLayout, RailLayout, Stack, Inline, InsetPanel, StickyPanel |
| `src/components/panels/` | Panel, PanelHeader, PanelTitle, PanelDescription, PanelToolbar, PanelContent, PanelFooter, PanelMeta |
| `src/components/states/` | LoadingBlock, LoadingRow, EmptyBlock, ErrorBlock, PlaceholderBlock |
| `src/components/data/` | DataTableShell, DataTableToolbar, DataTableFilters, DataTablePagination, RowActionsMenu, RowSelectionBar, DetailSheet, DataList, RecordGrid, RecordField, RecordMetaRow, RecordToolbar |
| `src/components/nav/` | CommandLauncher (cmd+k) |

## Page templates

Located in `src/app/(app)/_templates/`:

| Template | Use for |
|---|---|
| `template-a-workspace.tsx` | Dashboards, record overviews, module landing pages |
| `template-b-list-detail.tsx` | Operational list views (table + side sheet) |
| `template-c-settings.tsx` | Settings, config, admin pages (narrow) |
| `template-d-blank.tsx` | Scaffold skeleton for any new page |

## Overlay rules

- **Dialog** — confirmations, compact forms, destructive actions, focused edits
- **Sheet** — side detail, row drill-ins, record preview, secondary workflows
- **Drawer** — mobile navigation, mobile action regions
- **Popover/Tooltip** — lightweight contextual info only

## Data table rule

Use `DataTableShell` (TanStack Table) as the base for all operational list views.
Supports: sorting, filtering, pagination, column visibility, row selection, row expansion, row click → detail sheet.

## Composition rules

1. Every content unit maps to: page header / signal strip / panel / list region / table region / timeline region / detail region / sticky action region / overlay region
2. Prefer `Panel` (with full anatomy) over loose content
3. Right-side detail should be a Sheet before becoming a full page
4. Data-heavy views should be table-first, not chart-first
5. Shell must remain neutral — not encoded for any specific domain

## Anti-patterns (do not do)

- No generic KPI dashboard homepage assumptions
- No chart-led layout
- No random card grid as default page structure
- No premature brand styling
- No deeply nested ad hoc wrappers
- No business-specific naming for generic base primitives
- No mixing of shell, panel, and domain logic in the same component
