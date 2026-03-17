⏺ 1. Shared Primitive Inventory

  components/ui/table.tsx — Base table primitives

  ┌─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────┐
  │    Component    │                                      Current className                                       │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Table container │ relative w-full overflow-x-auto                                                              │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Table element   │ w-full caption-bottom text-sm                                                                │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ TableHeader     │ bg-muted/40 [&_tr]:border-b [&_tr]:border-border [&_tr]:hover:bg-transparent                 │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ TableBody       │ [&_tr:last-child]:border-0                                                                   │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ TableRow        │ hover:bg-muted data-[state=selected]:bg-muted border-b border-border transition-colors       │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ TableHead       │ text-muted-foreground h-10 px-3 text-left align-middle text-sm font-medium whitespace-nowrap │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ TableCell       │ px-3 py-2.5 align-top whitespace-nowrap                                                      │
  └─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────┘

  Assessment: This is now the canonical baseline. No legacy patterns remain. The text-muted-foreground on TableHead is correct — headers should be muted
  relative to cell data.

  components/ui/data-table.tsx — TanStack wrapper (used by Customers directory)

  ┌─────────────────┬────────────────────────────────────────────┐
  │     Element     │             Current className              │
  ├─────────────────┼────────────────────────────────────────────┤
  │ Outer wrapper   │ flex flex-col gap-3                        │
  ├─────────────────┼────────────────────────────────────────────┤
  │ Toolbar         │ flex items-center justify-between          │
  ├─────────────────┼────────────────────────────────────────────┤
  │ Row count       │ text-sm text-muted-foreground              │
  ├─────────────────┼────────────────────────────────────────────┤
  │ Table container │ overflow-hidden rounded-lg border bg-white │
  ├─────────────────┼────────────────────────────────────────────┤
  │ Clickable row   │ cursor-pointer hover:bg-muted/50           │
  ├─────────────────┼────────────────────────────────────────────┤
  │ Pagination      │ h-8 text-sm                                │
  └─────────────────┴────────────────────────────────────────────┘

  Assessment: Fully normalized. This is the reference wrapper.

  components/data/data-table.tsx — DataTableShell (used by (app) routes)

  ┌───────────────────────────┬─────────────────────────────────────────────────┐
  │          Element          │                Current className                │
  ├───────────────────────────┼─────────────────────────────────────────────────┤
  │ Table container           │ rounded-xl border border-border overflow-hidden │
  ├───────────────────────────┼─────────────────────────────────────────────────┤
  │ Header row                │ hover:bg-transparent (explicit override)        │
  ├───────────────────────────┼─────────────────────────────────────────────────┤
  │ Clickable row             │ cursor-pointer hover:bg-muted/40                │
  ├───────────────────────────┼─────────────────────────────────────────────────┤
  │ Pagination row count      │ text-xs text-muted-foreground                   │
  ├───────────────────────────┼─────────────────────────────────────────────────┤
  │ Pagination page indicator │ text-xs text-muted-foreground px-2              │
  └───────────────────────────┴─────────────────────────────────────────────────┘

  Assessment: Partially normalized. The hover:bg-transparent header override is now redundant (base TableHeader already does this). Pagination still uses
  text-xs — inconsistent with ui/data-table.tsx which uses text-sm. Container uses rounded-xl vs rounded-lg — slight mismatch.

  components/workspace/table-shell.tsx — Card wrapper for tables

  ┌─────────────────┬─────────────────────────┐
  │     Element     │    Current className    │
  ├─────────────────┼─────────────────────────┤
  │ CardTitle       │ text-base font-semibold │
  ├─────────────────┼─────────────────────────┤
  │ CardDescription │ text-sm                 │
  ├─────────────────┼─────────────────────────┤
  │ CardContent     │ p-0                     │
  └─────────────────┴─────────────────────────┘

  Assessment: Normalized.

  components/workspace/stat-card.tsx

  ┌─────────┬───────────────────────────────────────────┐
  │ Element │             Current className             │
  ├─────────┼───────────────────────────────────────────┤
  │ Label   │ text-xs font-medium text-muted-foreground │
  └─────────┴───────────────────────────────────────────┘

  Assessment: Normalized — was text-[11px] uppercase tracking-wider.

  ---
  2. Operational Table Inventory

  Tables using ui/table.tsx primitives directly:

  ┌───────────────────────────┬───────────────────────────────────────────────┬─────────────────────┬─────────────────────────┬────────────────────────────┐
  │          Surface          │                     File                      │ TableHead overrides │   Muted-on-populated    │   font-medium on amounts   │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Contracts list            │ (app)/contracts/page.tsx                      │ text-right only     │ No (fixed)              │ Yes                        │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Contract detail lines     │ (app)/contracts/[id]/page.tsx                 │ text-xs on all 10   │ Not audited             │ Not audited                │
  │                           │                                               │ headers             │                         │                            │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Customer detail (Stripe   │ (app)/customers/[id]/page.tsx                 │ text-xs on all      │ Yes: subscription       │ No on any amounts          │
  │ nested)                   │                                               │ headers (3 tables)  │ period                  │                            │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Customer 360 line items   │ (workspace)/.../customer-360.tsx              │ text-xs h-8 on 8    │ Yes: service period,    │ Partial: invoices/payments │
  │                           │                                               │ headers             │ payment method          │  yes, contracts no         │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Customer 360 contracts    │ same file                                     │ None                │ Audit needed            │ No                         │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Customer 360 invoices     │ same file                                     │ None                │ No                      │ Yes                        │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Customer 360 payments     │ same file                                     │ None                │ Yes: payment method     │ Yes                        │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Subscriptions/customers   │ (app)/subscriptions/customers/page.tsx        │ min-w-[180px] only  │ Yes: email, domain      │ N/A                        │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Sync events               │ (app)/admin/sync/sync-events-table.tsx        │ text-xs on all 6    │ Yes: object type,       │ N/A                        │
  │                           │                                               │ headers             │ actor, timestamp        │                            │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Sync jobs                 │ (app)/admin/sync/sync-jobs-table.tsx          │ text-xs on all 8    │ Yes: duration,          │ N/A                        │
  │                           │                                               │ headers             │ timestamp               │                            │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Renewal candidate detail  │ (app)/cs/renewals/[candidateId]/page.tsx      │ text-xs on headers  │ Not audited             │ Not audited                │
  │                           │                                               │ (2 tables)          │                         │                            │
  ├───────────────────────────┼───────────────────────────────────────────────┼─────────────────────┼─────────────────────────┼────────────────────────────┤
  │ Renewal draft editor      │ (app)/cs/renewals/drafts/.../draft-editor.tsx │ text-xs on 8        │ Not audited             │ Not audited                │
  │                           │                                               │ headers             │                         │                            │
  └───────────────────────────┴───────────────────────────────────────────────┴─────────────────────┴─────────────────────────┴────────────────────────────┘

  Tables using DataTable from ui/data-table.tsx:

  ┌─────────────────────┬─────────────────────────────────────────────────────────┬────────────────────────────────────────┐
  │       Surface       │                          File                           │                 Status                 │
  ├─────────────────────┼─────────────────────────────────────────────────────────┼────────────────────────────────────────┤
  │ Customers directory │ (workspace)/customers/customers-shell.tsx + columns.tsx │ Fully normalized (canonical reference) │
  └─────────────────────┴─────────────────────────────────────────────────────────┴────────────────────────────────────────┘

  Tables using DataTableShell from data/data-table.tsx:

  ┌──────────────────────┬───────────────────────┬────────────────────────────────────────────────────────────────────────────┐
  │       Surface        │         File          │                                   Status                                   │
  ├──────────────────────┼───────────────────────┼────────────────────────────────────────────────────────────────────────────┤
  │ Various (app) routes │ Via template patterns │ Partially normalized (pagination text-xs, redundant header hover override) │
  └──────────────────────┴───────────────────────┴────────────────────────────────────────────────────────────────────────────┘

  Custom card-based list surfaces (NOT using Table primitives):

  ┌─────────────────────────┬─────────────────────────────────────────────┬────────────────────────────────────────────────┐
  │         Surface         │                    File                     │                     Status                     │
  ├─────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ Accounts table          │ (app)/customers/accounts-table.tsx          │ Custom divs. ARR muted. MRR font-semibold.     │
  ├─────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ Opportunities table     │ (app)/opportunities/opportunities-table.tsx │ Custom divs. Amount muted. Account name muted. │
  ├─────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ Quotes list             │ (app)/quotes/quote-list-table.tsx           │ Custom divs. Amount muted. No font-medium.     │
  ├─────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ Renewals dashboard      │ (app)/cs/renewals/renewals-dashboard.tsx    │ Custom cards. MRR muted in section tables.     │
  ├─────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ Subscriptions dashboard │ (app)/subscriptions/dashboard-section.tsx   │ Custom divs. MRR muted.                        │
  └─────────────────────────┴─────────────────────────────────────────────┴────────────────────────────────────────────────┘

  Custom HTML table (not shadcn):

  ┌─────────────────┬────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────┐
  │     Surface     │                    File                    │                                       Status                                       │
  ├─────────────────┼────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ Renewals report │ (app)/cs/reports/renewals-report-table.tsx │ Raw <table>/<thead>/<tbody>. CSM/status/owner all muted. MRR muted. ARR font-bold. │
  └─────────────────┴────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────┘

  ---
  3. Legacy Styling Audit

  uppercase — 1 remaining occurrence

  ┌───────────────────────────────────────┬──────┬──────────────────┬────────────────────────────────────────────────┐
  │                 File                  │ Line │     Context      │                 Classification                 │
  ├───────────────────────────────────────┼──────┼──────────────────┼────────────────────────────────────────────────┤
  │ components/workspace/status-badge.tsx │ 5    │ Badge base class │ Leave alone — legitimate compact badge pattern │
  └───────────────────────────────────────┴──────┴──────────────────┴────────────────────────────────────────────────┘

  tracking-widest / tracking-wider — 3 remaining occurrences

  ┌─────────────────────────────────┬──────┬─────────────────────────┬─────────────────────────────────────────────────┐
  │              File               │ Line │         Context         │                 Classification                  │
  ├─────────────────────────────────┼──────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ components/ui/context-menu.tsx  │ 228  │ Keyboard shortcut label │ Leave alone — shadcn default, not table-related │
  ├─────────────────────────────────┼──────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ components/ui/dropdown-menu.tsx │ 187  │ Keyboard shortcut label │ Leave alone — shadcn default                    │
  ├─────────────────────────────────┼──────┼─────────────────────────┼─────────────────────────────────────────────────┤
  │ components/ui/command.tsx       │ 166  │ Keyboard shortcut label │ Leave alone — shadcn default                    │
  └─────────────────────────────────┴──────┴─────────────────────────┴─────────────────────────────────────────────────┘

  text-xs on TableHead — 7 files, ~50 headers

  ┌───────────────────────────────────────────────┬──────────────────────────────┬────────────────────────────────────────────────────────────────┐
  │                     File                      │       Headers affected       │                         Classification                         │
  ├───────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ (app)/customers/[id]/page.tsx                 │ 3 nested tables, all headers │ Probably migrate — subordinate tables but still fight baseline │
  ├───────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ (workspace)/.../customer-360.tsx              │ 8 headers (line items)       │ Caution — intentionally subordinate, has h-8 compact sizing    │
  ├───────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ (app)/contracts/[id]/page.tsx                 │ 10 headers                   │ Safe to migrate                                                │
  ├───────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ (app)/cs/renewals/[candidateId]/page.tsx      │ ~10 headers (2 tables)       │ Safe to migrate                                                │
  ├───────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ (app)/cs/renewals/drafts/.../draft-editor.tsx │ 8 headers                    │ Safe to migrate                                                │
  ├───────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ (app)/admin/sync/sync-events-table.tsx        │ 6 headers                    │ Safe to migrate                                                │
  ├───────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ (app)/admin/sync/sync-jobs-table.tsx          │ 8 headers                    │ Safe to migrate                                                │
  └───────────────────────────────────────────────┴──────────────────────────────┴────────────────────────────────────────────────────────────────┘

  text-[10px] on badges — ~24 occurrences across 10+ files

  Classification: These are badge-level sizing, not header/label patterns. Defer — not part of the table normalization scope.

  text-[11px] — ~15 remaining occurrences

  All in non-shared contexts: co-term config inline metadata, renewals-dashboard status badges, activity-row timestamps, tab-bar counts. Defer — per-page
  density choices.

  rounded-md on table containers — 0 remaining

  All table containers now use rounded-lg or rounded-xl.

  Redundant header hover override

  ┌────────────────────────────────┬────────────────────────────────────┬────────────────────────────────────────────────────────┐
  │              File              │              Context               │                     Classification                     │
  ├────────────────────────────────┼────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ components/data/data-table.tsx │ hover:bg-transparent on header row │ Safe to remove — base TableHeader already handles this │
  └────────────────────────────────┴────────────────────────────────────┴────────────────────────────────────────────────────────┘

  DataTableShell pagination sizing mismatch

  ┌────────────────────────────────┬─────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────┐
  │              File              │                     Context                     │                            Classification                            │
  ├────────────────────────────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ components/data/data-table.tsx │ text-xs on pagination row count and page        │ Should migrate — inconsistent with ui/data-table.tsx which uses      │
  │                                │ indicator                                       │ text-sm                                                              │
  └────────────────────────────────┴─────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────┘

  ---
  4. Contrast Contract Audit — Muted-on-Populated Violations

  High confidence (populated operational data unconditionally muted):

  ┌──────────────────────────────────┬───────────────────────────────────┬─────────────────────────────────────────┬─────────────┐
  │               File               │               Field               │                 Current                 │     Fix     │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ customer-360.tsx                 │ Service period dates (line items) │ text-xs text-muted-foreground           │ Conditional │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ customer-360.tsx                 │ Payment method                    │ text-muted-foreground                   │ Conditional │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ customer-360.tsx                 │ Invoice ID (payments card)        │ font-mono text-xs text-muted-foreground │ Conditional │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ customers/[id]/page.tsx          │ Subscription period dates         │ text-xs text-muted-foreground           │ Conditional │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ subscriptions/customers/page.tsx │ Email                             │ text-muted-foreground                   │ Conditional │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ subscriptions/customers/page.tsx │ Domain                            │ text-muted-foreground                   │ Conditional │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ sync-events-table.tsx            │ Object type                       │ font-mono text-xs text-muted-foreground │ Foreground  │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ sync-events-table.tsx            │ Timestamp                         │ text-xs text-muted-foreground           │ Conditional │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ sync-jobs-table.tsx              │ Duration                          │ text-xs text-muted-foreground           │ Conditional │
  ├──────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────────────┼─────────────┤
  │ sync-jobs-table.tsx              │ Started timestamp                 │ text-xs text-muted-foreground           │ Conditional │
  └──────────────────────────────────┴───────────────────────────────────┴─────────────────────────────────────────┴─────────────┘

  Medium confidence (card-based lists, muted by layout choice):

  ┌─────────────────────────────────────┬─────────────────┬─────────────────────────────────────────┐
  │                File                 │      Field      │                 Current                 │
  ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────────────┤
  │ renewals-report-table.tsx           │ CSM name        │ text-muted-foreground                   │
  ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────────────┤
  │ renewals-report-table.tsx           │ Contract status │ text-muted-foreground                   │
  ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────────────┤
  │ renewals-report-table.tsx           │ Owner name      │ text-muted-foreground                   │
  ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────────────┤
  │ renewals-report-table.tsx           │ MRR             │ text-muted-foreground (!)               │
  ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────────────┤
  │ subscriptions/dashboard-section.tsx │ MRR             │ text-xs font-mono text-muted-foreground │
  ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────────────┤
  │ opportunities-table.tsx             │ Amount          │ text-xs font-mono text-muted-foreground │
  ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────────────┤
  │ quotes/quote-list-table.tsx         │ Total amount    │ text-xs text-muted-foreground           │
  ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────────────┤
  │ accounts-table.tsx                  │ ARR             │ text-xs text-muted-foreground font-mono │
  └─────────────────────────────────────┴─────────────────┴─────────────────────────────────────────┘

  ---
  5. Numeric Hierarchy Audit — Missing font-medium on Commercial Values

  ┌─────────────────────────────────────┬────────────────────────────┬─────────────────────────────────────────┬─────────────────────────────┐
  │                File                 │           Field            │             Current weight              │         Recommended         │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ customer-360.tsx                    │ Contracts MRR/ARR          │ tabular-nums (no weight)                │ font-medium                 │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ customer-360.tsx                    │ Subscription MRR           │ text-sm tabular-nums (no weight)        │ font-medium                 │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ customers/[id]/page.tsx             │ Subscription item price    │ font-mono text-xs                       │ font-medium                 │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ customers/[id]/page.tsx             │ Payment amount             │ font-mono text-xs                       │ font-medium                 │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ customers/[id]/page.tsx             │ Invoice amounts (due/paid) │ font-mono text-xs                       │ font-medium                 │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ renewals-report-table.tsx           │ MRR                        │ font-mono text-muted-foreground         │ font-medium text-foreground │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ subscriptions/dashboard-section.tsx │ MRR per row                │ text-xs font-mono text-muted-foreground │ font-medium                 │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ opportunities-table.tsx             │ Opp amount                 │ text-xs font-mono text-muted-foreground │ font-medium                 │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ quotes/quote-list-table.tsx         │ Quote total                │ text-xs text-muted-foreground           │ font-medium                 │
  ├─────────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────┼─────────────────────────────┤
  │ accounts-table.tsx                  │ ARR                        │ text-xs text-muted-foreground font-mono │ font-medium                 │
  └─────────────────────────────────────┴────────────────────────────┴─────────────────────────────────────────┴─────────────────────────────┘

  Already correct: Customers directory MRR/ARR, Contracts list MRR/ARR, Customer 360 invoice totals, Customer 360 payment amounts.

  ---
  6. Risk Map

  Safe global changes (zero regression risk):

  - Remove redundant hover:bg-transparent from data/data-table.tsx header row (already handled by base TableHeader)

  Safe shared primitive changes:

  - Normalize data/data-table.tsx pagination from text-xs to text-sm (aligns with ui/data-table.tsx)

  Safe feature-level migrations (tables using shared primitives, isolated pages):

  1. contracts/[id]/page.tsx — remove text-xs header overrides, fix cell tones
  2. sync-events-table.tsx — remove text-xs header overrides, fix cell tones
  3. sync-jobs-table.tsx — remove text-xs header overrides, fix cell tones
  4. cs/renewals/[candidateId]/page.tsx — remove text-xs header overrides
  5. cs/renewals/drafts/.../draft-editor.tsx — remove text-xs header overrides
  6. subscriptions/customers/page.tsx — fix muted-on-populated email/domain
  7. customer-360.tsx contracts table — add font-medium on MRR/ARR

  Moderate risk (needs careful review):

  - customers/[id]/page.tsx nested Stripe tables — removing text-xs headers changes density of subordinate tables inside cards
  - customer-360.tsx line items table — text-xs h-8 is an intentional compact nesting pattern, removing it changes the visual hierarchy
  - renewals-report-table.tsx — uses raw HTML <table>, not shadcn primitives. Fixing cell tones is safe but doesn't inherit shared styling.

  Higher risk (card-based lists, different layout paradigm):

  - accounts-table.tsx, opportunities-table.tsx, quotes/quote-list-table.tsx, subscriptions/dashboard-section.tsx, renewals-dashboard.tsx — these are card-based
   list layouts, not tables. Muted text is sometimes a layout density choice. Changes require per-file judgment.

  Legacy/quarantined (leave alone):

  - status-badge.tsx uppercase — legitimate badge pattern
  - context-menu.tsx, dropdown-menu.tsx, command.tsx tracking-widest — shadcn defaults for keyboard shortcut labels
  - text-[10px] on Badge components throughout — badge sizing, not table styling
  - text-[11px] in co-term config, renewals-dashboard badges — per-page density

  ---
  7. Proposed Migration Sequence

  Phase 1 — Shared primitive alignment (1 file, zero risk)
  1. data/data-table.tsx: Remove redundant header hover override, normalize pagination to text-sm

  Phase 2 — Table-primitive tables with text-xs header overrides (5 files, low risk)
  1. contracts/[id]/page.tsx — remove text-xs from 10 headers
  2. sync-events-table.tsx — remove text-xs from 6 headers
  3. sync-jobs-table.tsx — remove text-xs from 8 headers
  4. cs/renewals/[candidateId]/page.tsx — remove text-xs from headers
  5. cs/renewals/drafts/.../draft-editor.tsx — remove text-xs from headers

  Phase 3 — Contrast contract fixes on table-primitive surfaces (4 files, low risk)
  1. customer-360.tsx — service period, payment method, invoice ID → conditional
  2. customers/[id]/page.tsx — subscription period → conditional
  3. subscriptions/customers/page.tsx — email, domain → conditional
  4. sync-events-table.tsx + sync-jobs-table.tsx — timestamps, object type, duration → conditional

  Phase 4 — Numeric hierarchy on table-primitive surfaces (3 files, low risk)
  1. customer-360.tsx — contracts MRR/ARR, subscription MRR → font-medium
  2. customers/[id]/page.tsx — amounts in 3 nested tables → font-medium
  3. renewals-report-table.tsx — MRR → font-medium text-foreground

  Phase 5 — Subordinate table decision (2 files, moderate risk — review before applying)
  1. customer-360.tsx line items — evaluate whether text-xs h-8 should stay or go
  2. customers/[id]/page.tsx nested Stripe tables — evaluate whether text-xs headers should inherit text-sm base

  Phase 6 — Card-based list surfaces (5 files, higher risk — per-file judgment)
  1. accounts-table.tsx — ARR muted, no font-medium
  2. opportunities-table.tsx — amount muted
  3. quotes/quote-list-table.tsx — total amount muted
  4. subscriptions/dashboard-section.tsx — MRR muted
  5. renewals-dashboard.tsx — MRR muted in section tables