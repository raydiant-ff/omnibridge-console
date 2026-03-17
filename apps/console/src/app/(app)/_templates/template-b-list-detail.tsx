"use client";

/**
 * Template B — List / Detail Page
 *
 * Layout: page header + data table; row click opens side sheet
 * Use for: any operational list view (quotes, subscriptions, invoices, etc.)
 */

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { PageViewport, PageHeader, PageHeaderMeta, PageActions } from "@/components/layout";
import { DataTableShell, DataTableToolbar, DetailSheet, RecordField } from "@/components/data";
import { Panel } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Placeholder data
// ---------------------------------------------------------------------------

interface SampleRow {
  id: string;
  name: string;
  status: "active" | "pending" | "cancelled";
  amount: string;
  date: string;
}

const SAMPLE_DATA: SampleRow[] = [
  { id: "1", name: "Acme Corp", status: "active", amount: "$12,000", date: "2026-03-01" },
  { id: "2", name: "Beta Inc", status: "pending", amount: "$4,500", date: "2026-02-28" },
  { id: "3", name: "Gamma LLC", status: "cancelled", amount: "$8,200", date: "2026-02-20" },
  { id: "4", name: "Delta Co", status: "active", amount: "$22,000", date: "2026-02-15" },
  { id: "5", name: "Epsilon Ltd", status: "pending", amount: "$6,750", date: "2026-02-10" },
];

const COLUMNS: ColumnDef<SampleRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ getValue }) => (
      <span className="font-medium text-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const v = getValue() as SampleRow["status"];
      return (
        <Badge variant={v === "active" ? "success" : v === "pending" ? "warning" : "destructive"}>
          {v}
        </Badge>
      );
    },
  },
  { accessorKey: "amount", header: "Amount" },
  { accessorKey: "date", header: "Date" },
];

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export default function TemplateBListDetail() {
  const [selected, setSelected] = useState<SampleRow | null>(null);
  const [search, setSearch] = useState("");

  const filtered = SAMPLE_DATA.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PageViewport>
      {/* Page header */}
      <PageHeader>
        <PageHeaderMeta
          title="List / Detail Page"
          description="Data table with row click opening a side sheet"
        />
        <PageActions>
          <Button size="sm">New record</Button>
        </PageActions>
      </PageHeader>

      {/* Table */}
      <Panel>
        <DataTableShell
          columns={COLUMNS}
          data={filtered}
          selectable
          onRowClick={setSelected}
          toolbar={
            <DataTableToolbar
              searchPlaceholder="Search records…"
              searchValue={search}
              onSearchChange={setSearch}
              className="px-5 pt-4"
            />
          }
        />
      </Panel>

      {/* Detail sheet */}
      <DetailSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.name ?? ""}
        description="Record detail"
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <RecordField label="ID" value={selected.id} mono />
            <RecordField label="Status" value={selected.status} />
            <RecordField label="Amount" value={selected.amount} />
            <RecordField label="Date" value={selected.date} />
          </div>
        )}
      </DetailSheet>
    </PageViewport>
  );
}
