// ⚠️  FROZEN — do not add new components here.
// New UI components belong in components/shell/, components/layout/, components/panels/,
// components/states/, components/data/, or components/omni/.
// Existing consumers are stable; this barrel will not grow.
//
// For new detail/summary card layouts, use:
//   import { DetailCard, DetailRow } from "@/components/omni/detail-card"
// instead of Section/FieldRow/DetailGrid.
// See detail-card.tsx for usage examples.

export { PageHeader } from "./page-header";
export { Breadcrumb } from "./breadcrumb";
export { Toolbar } from "./toolbar";
export { Section, CommandSection } from "./section";
export { StatCard } from "./stat-card";
export { StatItem, StatRow } from "./stat-item";
export { StatusBadge } from "./status-badge";
export { StatusBreakdownItem } from "./status-breakdown";
export { CommandList, CommandRow } from "./command-list";
export type { ColumnDef, ColumnValue } from "./command-list";
export { ToolbarIconButton } from "./toolbar-icon-button";
export { ActionButton } from "./action-button";
export { TableShell } from "./table-shell";
export { EmptyState } from "./empty-state";
export { DetailGrid } from "./detail-grid";
export { FieldRow } from "./field-row";
