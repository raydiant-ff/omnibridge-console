"use client";

import { useState } from "react";
import type { OpportunityRow } from "@/lib/queries/opportunities";
import { OpportunitiesTable } from "../opportunities-table";
import { cn } from "@omnibridge/ui";
import { formatDollars } from "@/lib/format";
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  Tag,
  User,
  X,
} from "lucide-react";

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
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm text-foreground">{children}</span>
      </div>
    </div>
  );
}

function OpportunityDetailCard({ opp, onClose }: {
  opp: OpportunityRow;
  onClose: () => void;
}) {
  const sfUrl = opp.id
    ? `https://login.salesforce.com/${opp.id}`
    : null;

  const isPast = new Date(opp.closeDate) < new Date();
  const isOpen = opp.stageName !== "Closed Won" && opp.stageName !== "Closed Lost";
  const overdue = isOpen && isPast;

  return (
    <div className="rounded-2xl border border-border card-shadow overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground truncate">
                {opp.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {opp.accountName ?? "—"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <span
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-full",
              stageBadgeClasses(opp.stageName),
            )}
          >
            {opp.stageName}
          </span>
          {opp.type && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
              {opp.type}
            </span>
          )}
        </div>
      </div>

      {/* Amount highlight */}
      <div className="px-6 py-5 bg-muted/30 border-b border-border">
        <div className="text-xs text-muted-foreground mb-1">Deal Value</div>
        <div className="text-2xl font-semibold font-mono text-foreground">
          {formatDollars(opp.amount)}
        </div>
      </div>

      {/* Details */}
      <div className="px-6 py-2">
        <DetailRow icon={Building2} label="Account">
          {opp.accountName ?? "—"}
        </DetailRow>
        <DetailRow icon={User} label="Owner">
          {opp.ownerName ?? "—"}
        </DetailRow>
        <DetailRow icon={Tag} label="Type">
          {opp.type ?? "—"}
        </DetailRow>
        <DetailRow icon={Calendar} label="Close Date">
          <span className={cn(overdue && "text-destructive font-medium")}>
            {formatDate(opp.closeDate)}
            {overdue && " (overdue)"}
          </span>
        </DetailRow>
        <DetailRow icon={Clock} label="Created">
          {formatDateTime(opp.createdDate)}
        </DetailRow>
        <DetailRow icon={Clock} label="Last Modified">
          {formatDateTime(opp.lastModified)}
        </DetailRow>
      </div>

      {/* SFDC Link */}
      {sfUrl && (
        <div className="px-6 py-4 border-t border-border">
          <a
            href={sfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Salesforce
          </a>
        </div>
      )}
    </div>
  );
}

interface OpportunitiesSplitViewProps {
  opportunities: OpportunityRow[];
}

export function OpportunitiesSplitView({ opportunities }: OpportunitiesSplitViewProps) {
  const [selected, setSelected] = useState<OpportunityRow | null>(null);

  return (
    <div className="flex gap-6">
      <div className={cn(
        "transition-all duration-200",
        selected ? "w-1/2" : "w-full",
      )}>
        <OpportunitiesTable
          opportunities={opportunities}
          showOwner
          selectedId={selected?.id}
          onSelect={(opp) =>
            setSelected((prev) => (prev?.id === opp.id ? null : opp))
          }
        />
      </div>

      {selected && (
        <div className="w-1/2 sticky top-0 self-start">
          <OpportunityDetailCard
            opp={selected}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}
