"use client";

import { useMemo, useState } from "react";
import type { OpportunityRow } from "@/lib/queries/opportunities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function stageBadgeVariant(
  stage: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (stage) {
    case "Closed Won":
      return "default";
    case "Closed Lost":
      return "destructive";
    case "Contract Sent":
    case "Pricing & Negotiation":
      return "secondary";
    default:
      return "outline";
  }
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ALL = "__all__";

interface OpportunitiesTableProps {
  opportunities: OpportunityRow[];
  showOwner?: boolean;
}

export function OpportunitiesTable({
  opportunities,
  showOwner = false,
}: OpportunitiesTableProps) {
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [stageFilter, setStageFilter] = useState(ALL);
  const [closeDateFrom, setCloseDateFrom] = useState("");
  const [closeDateTo, setCloseDateTo] = useState("");

  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    for (const opp of opportunities) {
      if (opp.ownerName) set.add(opp.ownerName);
    }
    return Array.from(set).sort();
  }, [opportunities]);

  const uniqueStages = useMemo(() => {
    const set = new Set<string>();
    for (const opp of opportunities) {
      if (opp.stageName) set.add(opp.stageName);
    }
    return Array.from(set).sort();
  }, [opportunities]);

  const filtered = useMemo(() => {
    return opportunities.filter((opp) => {
      if (ownerFilter !== ALL && opp.ownerName !== ownerFilter) return false;
      if (stageFilter !== ALL && opp.stageName !== stageFilter) return false;
      if (closeDateFrom && opp.closeDate < closeDateFrom) return false;
      if (closeDateTo && opp.closeDate > closeDateTo) return false;
      return true;
    });
  }, [opportunities, ownerFilter, stageFilter, closeDateFrom, closeDateTo]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {showOwner && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Owner
            </label>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger size="sm" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Owners</SelectItem>
                {uniqueOwners.map((owner) => (
                  <SelectItem key={owner} value={owner}>
                    {owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Stage
          </label>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger size="sm" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Stages</SelectItem>
              {uniqueStages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Close Date From
          </label>
          <Input
            type="date"
            value={closeDateFrom}
            onChange={(e) => setCloseDateFrom(e.target.value)}
            className="h-8 w-[150px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Close Date To
          </label>
          <Input
            type="date"
            value={closeDateTo}
            onChange={(e) => setCloseDateTo(e.target.value)}
            className="h-8 w-[150px] text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border px-4 py-12 text-center text-sm text-muted-foreground">
          No opportunities match the current filters.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Account</TableHead>
                {showOwner && <TableHead>Owner</TableHead>}
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Close Date</TableHead>
                <TableHead>Last Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((opp) => (
                <TableRow key={opp.id}>
                  <TableCell className="font-medium">{opp.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {opp.accountName ?? "-"}
                  </TableCell>
                  {showOwner && (
                    <TableCell className="text-muted-foreground">
                      {opp.ownerName ?? "-"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={stageBadgeVariant(opp.stageName)}>
                      {opp.stageName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(opp.amount)}
                  </TableCell>
                  <TableCell>{formatDate(opp.createdDate)}</TableCell>
                  <TableCell>{formatDate(opp.closeDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(opp.lastModified)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {opportunities.length} opportunities
      </p>
    </div>
  );
}
