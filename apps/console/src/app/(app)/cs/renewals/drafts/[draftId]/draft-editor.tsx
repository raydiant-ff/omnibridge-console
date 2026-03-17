"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RotateCw,
  Trash2,
  Plus,
  FileSignature,
  Zap,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftLineItem {
  id: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number;
  quantity: number;
  mrr: number;
  discount: number; // percentage 0-100
  overrideUnitAmount: number | null;
}

interface RenewalDraft {
  id: string;
  candidateId: string;
  subscriptionId: string;
  customerId: string;
  customerName: string;
  csmName: string | null;
  sfAccountId: string | null;
  sfContractId: string | null;
  contractNumber: string | null;
  lineItems: DraftLineItem[];
  contractTerm: string;
  billingFrequency: string;
  collectionMethod: string;
  effectiveDate: string;
  notes: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function computeMrr(
  unitAmount: number,
  interval: string | null,
  intervalCount: number,
  quantity: number,
): number {
  if (!interval) return 0;
  let months = 1;
  switch (interval) {
    case "year":
      months = intervalCount * 12;
      break;
    case "month":
      months = intervalCount;
      break;
    case "week":
      months = intervalCount / 4;
      break;
    case "day":
      months = intervalCount / 30;
      break;
  }
  if (months <= 0) return 0;
  return Math.round((unitAmount * quantity) / months);
}

function effectivePrice(item: DraftLineItem): number {
  const base = item.overrideUnitAmount ?? item.unitAmount;
  if (item.discount > 0) {
    return Math.round(base * (1 - item.discount / 100));
  }
  return base;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftEditor({ initialDraft }: { initialDraft: RenewalDraft }) {
  const [draft, setDraft] = useState<RenewalDraft>(initialDraft);
  const [confirmDialog, setConfirmDialog] = useState<"auto" | "signature" | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  function updateField<K extends keyof RenewalDraft>(key: K, value: RenewalDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setIsSaved(false);
  }

  function updateLineItem(index: number, updates: Partial<DraftLineItem>) {
    setDraft((d) => {
      const items = [...d.lineItems];
      const item = { ...items[index], ...updates };
      // Recompute MRR with effective price
      const price = effectivePrice(item);
      item.mrr = computeMrr(price, item.interval, item.intervalCount, item.quantity);
      items[index] = item;
      return { ...d, lineItems: items };
    });
    setIsSaved(false);
  }

  function removeLineItem(index: number) {
    setDraft((d) => ({
      ...d,
      lineItems: d.lineItems.filter((_, i) => i !== index),
    }));
    setIsSaved(false);
  }

  function addBlankLineItem() {
    setDraft((d) => ({
      ...d,
      lineItems: [
        ...d.lineItems,
        {
          id: `new-${Date.now()}`,
          productName: "New Product",
          unitAmount: 0,
          currency: "usd",
          interval: "month",
          intervalCount: 1,
          quantity: 1,
          mrr: 0,
          discount: 0,
          overrideUnitAmount: null,
        },
      ],
    }));
    setIsSaved(false);
  }

  async function saveDraft() {
    // Persist to cookie via API call
    try {
      await fetch(`/api/renewals/drafts/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setIsSaved(true);
    } catch {
      // Fail silently for demo
    }
  }

  // Compute totals
  const totalMrr = draft.lineItems.reduce((sum, item) => {
    const price = effectivePrice(item);
    return sum + computeMrr(price, item.interval, item.intervalCount, item.quantity);
  }, 0);
  const totalArr = totalMrr * 12;

  // Build the renewal wizard URL for "Quote for Signature" path
  const renewWizardUrl = `/cs/renewals/create?sub=${encodeURIComponent(draft.subscriptionId)}&customer=${encodeURIComponent(draft.customerId)}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Draft metadata */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Contract Term */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Contract Term</Label>
          <Select
            value={draft.contractTerm}
            onValueChange={(v) => updateField("contractTerm", v)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mtm">Month-to-Month</SelectItem>
              <SelectItem value="1yr">1 Year</SelectItem>
              <SelectItem value="2yr">2 Years</SelectItem>
              <SelectItem value="3yr">3 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Billing Frequency */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Billing Frequency</Label>
          <Select
            value={draft.billingFrequency}
            onValueChange={(v) => updateField("billingFrequency", v)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="semi_annual">Semi-Annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="2yr">Every 2 Years</SelectItem>
              <SelectItem value="3yr">Every 3 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Effective Date */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Effective Date</Label>
          <Input
            type="date"
            value={draft.effectiveDate.slice(0, 10)}
            onChange={(e) => updateField("effectiveDate", e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Collection Method */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Collection</Label>
          <Select
            value={draft.collectionMethod}
            onValueChange={(v) => updateField("collectionMethod", v)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="charge_automatically">Auto-Charge</SelectItem>
              <SelectItem value="send_invoice">Send Invoice</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Line items table */}
      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Line Items</CardTitle>
              <CardDescription className="text-xs">
                {draft.lineItems.length} item{draft.lineItems.length !== 1 ? "s" : ""} &middot;
                Pre-filled from Stripe subscription
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addBlankLineItem} className="h-7 text-xs">
              <Plus className="mr-1 size-3" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-[80px] text-right">Qty</TableHead>
                  <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                  <TableHead className="w-[120px] text-right">Override Price</TableHead>
                  <TableHead className="w-[80px] text-right">Discount %</TableHead>
                  <TableHead className="w-[100px] text-right">Effective</TableHead>
                  <TableHead className="w-[100px] text-right">MRR</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.lineItems.map((item, idx) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    onUpdate={(updates) => updateLineItem(idx, updates)}
                    onRemove={() => removeLineItem(idx)}
                  />
                ))}
                {draft.lineItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      No line items. Add at least one to continue.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Internal Notes</Label>
        <textarea
          value={draft.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Add renewal notes, context, or instructions..."
          rows={3}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Summary + Actions */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Total MRR</p>
            <p className="text-lg font-bold tabular-nums">{fmtCurrency(totalMrr)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total ARR</p>
            <p className="text-lg font-bold tabular-nums">{fmtCurrency(totalArr)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Items</p>
            <p className="text-lg font-bold tabular-nums">{draft.lineItems.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={saveDraft}
            disabled={isSaved}
          >
            <Save className="mr-1 size-3" />
            {isSaved ? "Saved" : "Save Draft"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmDialog("auto")}
            disabled={draft.lineItems.length === 0}
          >
            <Zap className="mr-1 size-3" />
            Automatic Renewal
          </Button>

          <Button
            size="sm"
            onClick={() => setConfirmDialog("signature")}
            disabled={draft.lineItems.length === 0}
          >
            <FileSignature className="mr-1 size-3" />
            Quote for Signature
          </Button>
        </div>
      </div>

      {/* Confirmation dialogs */}
      <Dialog open={confirmDialog === "auto"} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-4" />
              Automatic Renewal
            </DialogTitle>
            <DialogDescription>
              This will process the renewal automatically using the current draft configuration.
              The subscription will be renewed with the line items, pricing, and terms shown in the draft.
              No customer signature is required.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{draft.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Term</span>
                <span>{termLabel(draft.contractTerm)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective</span>
                <span>{draft.effectiveDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MRR</span>
                <span className="font-mono">{fmtCurrency(totalMrr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span>{draft.lineItems.length}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button asChild>
              <Link href={renewWizardUrl}>
                <Zap className="mr-1 size-3" />
                Proceed to Renewal
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog === "signature"} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="size-4" />
              Quote for Signature
            </DialogTitle>
            <DialogDescription>
              This will create a formal renewal quote that can be sent to the customer for
              review and electronic signature via DocuSign. The quote will include the line items,
              pricing, and terms from this draft.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{draft.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Term</span>
                <span>{termLabel(draft.contractTerm)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective</span>
                <span>{draft.effectiveDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MRR</span>
                <span className="font-mono">{fmtCurrency(totalMrr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span>{draft.lineItems.length}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button asChild>
              <Link href={renewWizardUrl}>
                <FileSignature className="mr-1 size-3" />
                Create Quote
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line item row
// ---------------------------------------------------------------------------

function LineItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: DraftLineItem;
  onUpdate: (updates: Partial<DraftLineItem>) => void;
  onRemove: () => void;
}) {
  const effective = effectivePrice(item);

  return (
    <TableRow>
      <TableCell>
        <Input
          value={item.productName}
          onChange={(e) => onUpdate({ productName: e.target.value })}
          className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) })}
          className="h-7 w-[70px] text-right text-sm"
        />
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground">
        {fmtCurrency(item.unitAmount)}
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step={1}
          placeholder="\u2014"
          value={item.overrideUnitAmount != null ? item.overrideUnitAmount / 100 : ""}
          onChange={(e) => {
            const val = e.target.value;
            onUpdate({
              overrideUnitAmount: val ? Math.round(parseFloat(val) * 100) : null,
            });
          }}
          className="h-7 w-[100px] text-right text-sm"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={item.discount || ""}
          placeholder="0"
          onChange={(e) =>
            onUpdate({ discount: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })
          }
          className="h-7 w-[60px] text-right text-sm"
        />
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {effective !== item.unitAmount ? (
          <span className="text-emerald-600">{fmtCurrency(effective)}</span>
        ) : (
          fmtCurrency(effective)
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {fmtCurrency(computeMrr(effective, item.interval, item.intervalCount, item.quantity))}/mo
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-sm p-1 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function termLabel(term: string): string {
  const labels: Record<string, string> = {
    mtm: "Month-to-Month",
    "1yr": "1 Year",
    "2yr": "2 Years",
    "3yr": "3 Years",
  };
  return labels[term] ?? term;
}
