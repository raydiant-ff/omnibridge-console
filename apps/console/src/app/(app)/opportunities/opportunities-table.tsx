"use client";

import { useMemo, useState } from "react";
import type { OpportunityRow } from "@/lib/queries/opportunities";
import { cn } from "@omnibridge/ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListShell } from "@/components/omni/list-shell";
import { ListRow, ListRowTitle, ListRowDetail } from "@/components/omni/list-row";
import { FilterBar, FilterField } from "@/components/omni/filter-bar";
import { formatDollars } from "@/lib/format";
import {
  CheckCircle,
  XCircle,
  Clock,
  Send,
  DollarSign,
  Search,
  Calendar,
  MoreHorizontal,
} from "lucide-react";

function stageIcon(stage: string) {
  switch (stage) {
    case "Closed Won":
      return { Icon: CheckCircle, bg: "bg-success/10", text: "text-success" };
    case "Closed Lost":
      return { Icon: XCircle, bg: "bg-destructive/10", text: "text-destructive" };
    case "Contract Sent":
      return { Icon: Send, bg: "bg-purple-500/10", text: "text-purple-600" };
    case "Pricing & Negotiation":
      return { Icon: DollarSign, bg: "bg-amber-500/10", text: "text-amber-600" };
    case "Customer Evaluation":
      return { Icon: Search, bg: "bg-blue-500/10", text: "text-blue-600" };
    default:
      return { Icon: Clock, bg: "bg-muted", text: "text-muted-foreground" };
  }
}

function stageBadgeClasses(stage: string): string {
  switch (stage) {
    case "Closed Won":
      return "bg-success/10 text-success";
    case "Closed Lost":
      return "bg-destructive/10 text-destructive";
    case "Contract Sent":
      return "bg-purple-500/10 text-purple-600";
    case "Pricing & Negotiation":
      return "bg-amber-500/10 text-amber-600";
    case "Customer Evaluation":
      return "bg-blue-500/10 text-blue-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function ownerInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const ALL = "__all__";

export interface OpportunitiesTableProps {
  opportunities: OpportunityRow[];
  showOwner?: boolean;
  selectedId?: string | null;
  onSelect?: (opp: OpportunityRow) => void;
}

export function OpportunitiesTable({
  opportunities,
  showOwner = false,
  selectedId,
  onSelect,
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
    return opportunities
      .filter((opp) => {
        if (ownerFilter !== ALL && opp.ownerName !== ownerFilter) return false;
        if (stageFilter !== ALL && opp.stageName !== stageFilter) return false;
        if (closeDateFrom && opp.closeDate < closeDateFrom) return false;
        if (closeDateTo && opp.closeDate > closeDateTo) return false;
        return true;
      })
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  }, [opportunities, ownerFilter, stageFilter, closeDateFrom, closeDateTo]);

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        {showOwner && (
          <FilterField label="Owner">
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
          </FilterField>
        )}

        <FilterField label="Stage">
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
        </FilterField>

        <FilterField label="Close Date From">
          <Input
            type="date"
            value={closeDateFrom}
            onChange={(e) => setCloseDateFrom(e.target.value)}
            className="h-8 w-[150px] text-sm"
          />
        </FilterField>

        <FilterField label="Close Date To">
          <Input
            type="date"
            value={closeDateTo}
            onChange={(e) => setCloseDateTo(e.target.value)}
            className="h-8 w-[150px] text-sm"
          />
        </FilterField>
      </FilterBar>

      <ListShell
        title="All Opportunities"
        count={filtered.length}
        total={filtered.length !== opportunities.length ? opportunities.length : undefined}
        isEmpty={filtered.length === 0}
        empty={
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No opportunities match the current filters.
          </div>
        }
      >
        {filtered.map((opp) => {
          const overdue =
            opp.stageName !== "Closed Won" &&
            opp.stageName !== "Closed Lost" &&
            isPast(opp.closeDate);
          const isSelected = selectedId === opp.id;
          const { Icon, bg, text } = stageIcon(opp.stageName);

          return (
            <ListRow
              key={opp.id}
              onClick={() => onSelect?.(opp)}
              selected={isSelected}
              icon={
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    isSelected ? "bg-primary/10" : bg,
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5",
                      isSelected ? "text-primary" : text,
                    )}
                  />
                </div>
              }
              value={
                <span className={`text-sm font-medium tabular-nums ${opp.amount ? "text-foreground" : "text-muted-foreground"}`}>
                  {formatDollars(opp.amount)}
                </span>
              }
              meta={
                <>
                  <div
                    className={cn(
                      "flex items-center gap-2 text-sm",
                      overdue
                        ? "text-destructive font-medium"
                        : "text-foreground",
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(opp.closeDate)}</span>
                    {overdue && (
                      <span className="text-xs font-semibold">Overdue</span>
                    )}
                  </div>

                  {showOwner && opp.ownerName && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-chart-1/20 flex items-center justify-center text-xs font-medium text-chart-1">
                        {ownerInitials(opp.ownerName)}
                      </div>
                      <span className="text-sm text-foreground">
                        {opp.ownerName}
                      </span>
                    </div>
                  )}

                  <span className="text-sm text-muted-foreground w-20 text-right">
                    {timeAgo(opp.lastModified)}
                  </span>
                </>
              }
              actions={
                <button
                  type="button"
                  className="p-1 hover:bg-muted rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              }
            >
              <ListRowTitle>
                <span className="font-medium text-foreground truncate">
                  {opp.name}
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded-full shrink-0",
                    stageBadgeClasses(opp.stageName),
                  )}
                >
                  {opp.stageName}
                </span>
              </ListRowTitle>
              <ListRowDetail>
                <span className="truncate text-foreground">
                  {opp.accountName ?? "—"}
                </span>
                {opp.type && (
                  <span className="font-mono text-xs">
                    ({opp.type})
                  </span>
                )}
              </ListRowDetail>
            </ListRow>
          );
        })}
      </ListShell>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {opportunities.length} opportunities
      </p>
    </div>
  );
}
