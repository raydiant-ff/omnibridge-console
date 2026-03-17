"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Power,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  MoreHorizontal,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { StripeProduct, StripeProductPrice } from "@/lib/queries/stripe-products";
import { fetchPricesForProduct } from "@/lib/queries/stripe-products";
import { deactivateStripeProducts } from "@/lib/actions/stripe-products";
import type { SfdcProduct } from "@/lib/queries/sfdc-products";
import type { ProductLogEntry } from "@/lib/queries/product-logs";

type StatusFilter = "all" | "active" | "inactive";

function formatStripeCurrency(amount: number | null, currency: string): string {
  if (amount === null) return "---";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function formatSfdcCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatInterval(interval: string | null, type: "recurring" | "one_time"): string {
  if (type === "one_time") return "one-time";
  return interval ? `/ ${interval}` : "";
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgoFromTs(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts * 1000;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatTimestamp(ts);
}

interface Props {
  stripeProducts: StripeProduct[];
  sfdcProducts: SfdcProduct[];
  isAdmin?: boolean;
  stripeLogs?: ProductLogEntry[];
  sfdcLogs?: ProductLogEntry[];
}

export function ProductCatalogTabs({ stripeProducts, sfdcProducts, isAdmin = false, stripeLogs = [], sfdcLogs = [] }: Props) {
  const router = useRouter();
  const [sfdcFilter, setSfdcFilter] = useState("");
  const [stripeFilter, setStripeFilter] = useState("");
  const [sfdcStatus, setSfdcStatus] = useState<StatusFilter>("active");
  const [stripeStatus, setStripeStatus] = useState<StatusFilter>("active");
  const [sfdcFamily, setSfdcFamily] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deactivatedIds, setDeactivatedIds] = useState<Set<string>>(new Set());
  const [deactivating, startDeactivate] = useTransition();

  const stripeById = useMemo(() => {
    const map = new Map<string, StripeProduct>();
    for (const p of stripeProducts) {
      map.set(p.id, p);
    }
    return map;
  }, [stripeProducts]);

  const sfdcFamilies = useMemo(() => {
    const set = new Set<string>();
    for (const p of sfdcProducts) {
      if (p.family) set.add(p.family);
    }
    return Array.from(set).sort();
  }, [sfdcProducts]);

  const filteredSfdc = useMemo(() => {
    return sfdcProducts.filter((p) => {
      if (sfdcStatus === "active" && !p.active) return false;
      if (sfdcStatus === "inactive" && p.active) return false;
      if (sfdcFamily !== "all" && p.family !== sfdcFamily) return false;
      if (!sfdcFilter) return true;
      const q = sfdcFilter.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.productCode?.toLowerCase().includes(q) ||
        p.family?.toLowerCase().includes(q) ||
        p.stripeProductId?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
  }, [sfdcProducts, sfdcFilter, sfdcStatus, sfdcFamily]);

  const liveStripeProducts = useMemo(
    () => stripeProducts.filter((p) => !deactivatedIds.has(p.id)),
    [stripeProducts, deactivatedIds],
  );

  const filteredStripe = useMemo(() => {
    return liveStripeProducts.filter((p) => {
      if (stripeStatus === "active" && !p.active) return false;
      if (stripeStatus === "inactive" && p.active) return false;
      if (!stripeFilter) return true;
      const q = stripeFilter.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    });
  }, [liveStripeProducts, stripeFilter, stripeStatus]);

  const sfdcActiveCount = filteredSfdc.filter((p) => p.active).length;
  const sfdcInactiveCount = filteredSfdc.filter((p) => !p.active).length;
  const stripeActiveCount = filteredStripe.filter((p) => p.active).length;
  const stripeInactiveCount = filteredStripe.filter((p) => !p.active).length;

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const activeIds = filteredStripe.filter((p) => p.active).map((p) => p.id);
    setSelected((prev) =>
      prev.size === activeIds.length && activeIds.every((id) => prev.has(id))
        ? new Set()
        : new Set(activeIds),
    );
  }, [filteredStripe]);

  const handleDeactivate = useCallback(() => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startDeactivate(async () => {
      const result = await deactivateStripeProducts(ids);
      setSelected(new Set());
      if (result.success.length > 0) {
        setDeactivatedIds((prev) => {
          const next = new Set(prev);
          for (const id of result.success) next.add(id);
          return next;
        });
      }
      if (result.failed.length > 0) {
        console.error("Failed to deactivate:", result.failed);
      }
      router.refresh();
    });
  }, [selected, router]);

  return (
    <Tabs defaultValue="salesforce">
      <TabsList>
        <TabsTrigger value="salesforce">
          Salesforce
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {sfdcProducts.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="stripe">
          Stripe
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {liveStripeProducts.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="stripe-log">
          Stripe Log
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {stripeLogs.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="sfdc-log">
          Salesforce Log
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {sfdcLogs.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="salesforce" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter by name, code, family, or Stripe ID..."
            value={sfdcFilter}
            onChange={(e) => setSfdcFilter(e.target.value)}
            className="max-w-sm"
          />
          <StatusDropdown value={sfdcStatus} onChange={setSfdcStatus} />
          <FamilyDropdown
            value={sfdcFamily}
            onChange={setSfdcFamily}
            families={sfdcFamilies}
          />
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{filteredSfdc.length}</span>{" "}
              shown
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground">{sfdcActiveCount}</span> active
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground">{sfdcInactiveCount}</span> inactive
            </span>
          </div>
        </div>

        {filteredSfdc.length === 0 ? (
          <EmptyState message="No Salesforce products match your filters." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredSfdc.map((p) => (
                  <SfdcRow key={p.id} product={p} stripeMap={stripeById} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="stripe" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter by name or ID..."
            value={stripeFilter}
            onChange={(e) => setStripeFilter(e.target.value)}
            className="max-w-sm"
          />
          <StatusDropdown value={stripeStatus} onChange={setStripeStatus} />
          {isAdmin && selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={deactivating}
              onClick={handleDeactivate}
            >
              {deactivating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Power className="size-3.5" />
              )}
              Deactivate {selected.size} product{selected.size > 1 ? "s" : ""}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{filteredStripe.length}</span>{" "}
              shown
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground">{stripeActiveCount}</span> active
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground">{stripeInactiveCount}</span> inactive
            </span>
          </div>
        </div>

        {filteredStripe.length === 0 ? (
          <EmptyState message="No Stripe products match your filters." />
        ) : (
          <Card>
            <CardHeader className="pb-4">
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={
                      filteredStripe.filter((p) => p.active).length > 0 &&
                      filteredStripe.filter((p) => p.active).every((p) => selected.has(p.id))
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                  <span className="text-xs text-muted-foreground">Select all active</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredStripe.map((p) => (
                  <StripeRow
                    key={p.id}
                    product={p}
                    isAdmin={isAdmin}
                    isSelected={selected.has(p.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="stripe-log" className="flex flex-col gap-4">
        <ActivityLogTab logs={stripeLogs} />
      </TabsContent>

      <TabsContent value="sfdc-log" className="flex flex-col gap-4">
        <ActivityLogTab logs={sfdcLogs} />
      </TabsContent>
    </Tabs>
  );
}

function ActivityLogTab({ logs }: { logs: ProductLogEntry[] }) {
  const [actionFilter, setActionFilter] = useState<string>("all");

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) set.add(l.action);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    if (actionFilter === "all") return logs;
    return logs.filter((l) => l.action === actionFilter);
  }, [logs, actionFilter]);

  return (
    <>
      <div className="flex items-center gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[170px]">
            <span className="text-muted-foreground mr-1">Action:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No activity log entries match your filters." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  created: "default",
  activated: "default",
  deactivated: "destructive",
  deleted: "destructive",
  updated: "secondary",
};

const ACTION_ICONS: Record<string, typeof CheckCircle2> = {
  created: CheckCircle2,
  activated: CheckCircle2,
  deactivated: XCircle,
  deleted: XCircle,
  updated: Clock,
};

function LogRow({ log }: { log: ProductLogEntry }) {
  const ts = new Date(log.createdAt);
  const formatted = ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const Icon = ACTION_ICONS[log.action] ?? Clock;
  const iconColor = log.action === "deactivated" || log.action === "deleted"
    ? "text-red-400"
    : log.action === "created" || log.action === "activated"
      ? "text-emerald-500"
      : "text-muted-foreground";

  return (
    <div className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50">
      <div className="shrink-0">
        <Icon className={`size-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{log.productName ?? "---"}</span>
          <Badge variant={ACTION_VARIANTS[log.action] ?? "secondary"} className="text-[10px] capitalize">
            {log.action}
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            {log.productId}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
          <span>{log.actorLabel}</span>
        </div>
      </div>
      <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
        {formatted}
      </div>
      <MoreHorizontal className="size-4 text-muted-foreground shrink-0" />
    </div>
  );
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusFilter)}>
      <SelectTrigger className="w-[150px]">
        <span className="text-muted-foreground mr-1">Status:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FamilyDropdown({
  value,
  onChange,
  families,
}: {
  value: string;
  onChange: (v: string) => void;
  families: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <span className="text-muted-foreground mr-1">Family:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {families.map((f) => (
          <SelectItem key={f} value={f}>
            {f}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SfdcRow({
  product,
  stripeMap,
}: {
  product: SfdcProduct;
  stripeMap: Map<string, StripeProduct>;
}) {
  const stripeProduct = product.stripeProductId
    ? stripeMap.get(product.stripeProductId)
    : null;

  return (
    <div className={`flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50 ${product.active ? "" : "opacity-60"}`}>
      {/* Status icon */}
      <div className="shrink-0">
        <Package className={`size-5 ${product.active ? "text-emerald-500" : "text-muted-foreground"}`} />
      </div>

      {/* Primary info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{product.name}</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {product.productCode ?? "---"}
          </Badge>
          {product.family && (
            <Badge variant="secondary" className="text-[10px]">
              {product.family}
            </Badge>
          )}
          <Badge variant={product.active ? "default" : "secondary"} className="text-[10px]">
            {product.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
          {product.description && (
            <span title={product.description}>
              {product.description.length > 60
                ? product.description.slice(0, 60) + "..."
                : product.description}
            </span>
          )}
          {product.stripeProductId && (
            <>
              {product.description && <span>&middot;</span>}
              <Link2 className="size-3" />
              <span className="font-mono">{product.stripeProductId}</span>
              {stripeProduct && <span>({stripeProduct.name})</span>}
              {product.stripeProductId && !stripeProduct && (
                <span className="text-destructive">Not found in Stripe</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right metadata */}
      <div className="flex items-center gap-3 shrink-0">
        <PricebookSummary entries={product.pricebookEntries} />
        <MoreHorizontal className="size-4 text-muted-foreground" />
      </div>
    </div>
  );
}

const SF_PRODUCT_META_KEYS = [
  "salesforce_product_id",
  "sf_product_id",
  "sfdc_product_id",
  "Salesforce_Product_ID",
  "SalesforceProductId",
];

function getSfProductId(metadata: Record<string, string>): string | null {
  for (const key of SF_PRODUCT_META_KEYS) {
    if (metadata[key]) return metadata[key];
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (key.toLowerCase().includes("salesforce") && key.toLowerCase().includes("product")) {
      return value;
    }
  }
  return null;
}

function StripeRow({
  product,
  isAdmin,
  isSelected,
  onToggleSelect,
}: {
  product: StripeProduct;
  isAdmin: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const sfProductId = getSfProductId(product.metadata);
  const [expanded, setExpanded] = useState(false);
  const [prices, setPrices] = useState<StripeProductPrice[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (prices) return;
    setLoading(true);
    try {
      const result = await fetchPricesForProduct(product.id);
      setPrices(result);
    } finally {
      setLoading(false);
    }
  }, [expanded, prices, product.id]);

  return (
    <>
      <div className={`flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50 group ${product.active ? "" : "opacity-60"}`}>
        {isAdmin && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(product.id)}
              disabled={!product.active}
              aria-label={`Select ${product.name}`}
            />
          </div>
        )}

        {/* Expand toggle */}
        <button type="button" onClick={toggle} className="shrink-0">
          {expanded ? (
            <ChevronDown className="size-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-5 text-muted-foreground" />
          )}
        </button>

        {/* Primary info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`https://dashboard.stripe.com/products/${product.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              {product.name}
            </a>
            <Badge variant={product.active ? "default" : "secondary"} className="text-[10px]">
              {product.active ? "Active" : "Inactive"}
            </Badge>
            {sfProductId && (
              <Badge variant="outline" className="font-mono text-[10px]">
                SF: {sfProductId}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
            {product.description && (
              <span title={product.description}>
                {product.description.length > 60
                  ? product.description.slice(0, 60) + "..."
                  : product.description}
              </span>
            )}
            {product.description && <span>&middot;</span>}
            <span className="font-mono">{product.id}</span>
          </div>
        </div>

        {/* Right metadata */}
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTimestamp(product.created)}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {timeAgoFromTs(product.updated)}
          </span>
          <MoreHorizontal className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Expanded prices panel */}
      {expanded && (
        <div className="bg-muted/30 px-6 py-4 border-t border-dashed">
          <div className="ml-12">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading prices...
              </div>
            ) : prices && prices.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {prices.length} price{prices.length > 1 ? "s" : ""}
                </span>
                <div className="divide-y">
                  {prices.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 py-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                      <span className="text-xs">{p.nickname ?? "---"}</span>
                      <span className="text-xs font-mono ml-auto">
                        {formatStripeCurrency(p.unitAmount, p.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatInterval(p.interval, p.type)}
                      </span>
                      <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No prices found.</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PricebookSummary({ entries }: { entries: SfdcProduct["pricebookEntries"] }) {
  if (entries.length === 0) {
    return <span className="text-xs text-muted-foreground">No entries</span>;
  }

  if (entries.length === 1) {
    const e = entries[0];
    return (
      <span className="text-xs">
        <span className="font-mono">{formatSfdcCurrency(e.unitPrice)}</span>{" "}
        <span className="text-muted-foreground">{e.pricebookName}</span>
      </span>
    );
  }

  return (
    <Select defaultValue={entries[0].id}>
      <SelectTrigger className="h-7 w-[220px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {entries.map((e) => (
          <SelectItem key={e.id} value={e.id} className="text-xs">
            {formatSfdcCurrency(e.unitPrice)} --- {e.pricebookName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
      <p className="text-sm font-medium">{message}</p>
      <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
    </div>
  );
}
