"use client";

import { useState, useTransition, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Trash2,
  Loader2,
  Plus,
  Search,
  Percent,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import type { StripeCoupon } from "@/lib/queries/stripe-coupons";
import { createCoupon, deleteCoupon } from "@/lib/actions/coupons";
import { formatDate } from "@/lib/format";

interface Props {
  initialCoupons: StripeCoupon[];
}

export function CouponsClient({ initialCoupons }: Props) {
  const { data: session } = useSession();
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "admin";
  const router = useRouter();

  const [coupons] = useState(initialCoupons);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return coupons;
    const q = search.toLowerCase();
    return coupons.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        (c.name ?? "").toLowerCase().includes(q),
    );
  }, [coupons, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search coupons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="mr-1.5 size-4" />
            Create Coupon
          </Button>
        )}
      </div>

      {showCreate && isAdmin && (
        <CreateCouponForm
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Coupons ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / ID</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Redemptions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Created</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 8 : 7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No coupons found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <CouponRow
                    key={c.id}
                    coupon={c}
                    isAdmin={isAdmin}
                    onDeleted={() => router.refresh()}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CouponRow({
  coupon,
  isAdmin,
  onDeleted,
}: {
  coupon: StripeCoupon;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete coupon "${coupon.name ?? coupon.id}"? This cannot be undone.`))
      return;
    startDelete(async () => {
      const result = await deleteCoupon(coupon.id);
      if (result.success) onDeleted();
      else alert(result.error);
    });
  }

  const discountLabel = coupon.percentOff
    ? `${coupon.percentOff}% off`
    : coupon.amountOff
      ? `$${(coupon.amountOff / 100).toFixed(2)} off`
      : "—";

  const durationLabel =
    coupon.duration === "forever"
      ? "Forever"
      : coupon.duration === "once"
        ? "Once"
        : `${coupon.durationInMonths} months`;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {coupon.name ?? "Unnamed"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {coupon.id}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {coupon.percentOff ? (
            <Percent className="mr-1 size-3" />
          ) : (
            <DollarSign className="mr-1 size-3" />
          )}
          {discountLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{durationLabel}</TableCell>
      <TableCell className="text-sm tabular-nums">
        {coupon.timesRedeemed}
        {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
      </TableCell>
      <TableCell>
        <Badge variant={coupon.valid ? "default" : "secondary"}>
          {coupon.valid ? "Active" : "Expired"}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {coupon.appliesTo && coupon.appliesTo.length > 0
          ? `${coupon.appliesTo.length} product${coupon.appliesTo.length > 1 ? "s" : ""}`
          : "All products"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(coupon.created)}
      </TableCell>
      {isAdmin && (
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

function CreateCouponForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [percentOff, setPercentOff] = useState("");
  const [amountOff, setAmountOff] = useState("");
  const [duration, setDuration] = useState<"once" | "forever" | "repeating">(
    "once",
  );
  const [durationInMonths, setDurationInMonths] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await createCoupon({
        name,
        type,
        percentOff: type === "percent" ? Number(percentOff) : undefined,
        amountOff:
          type === "fixed" ? Math.round(Number(amountOff) * 100) : undefined,
        currency: "usd",
        duration,
        durationInMonths:
          duration === "repeating" ? Number(durationInMonths) : undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      });
      if (result.success) {
        onCreated();
      } else {
        setError(result.error ?? "Failed to create coupon.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>New Coupon</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-name">Coupon Name</Label>
            <Input
              id="coupon-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 20% Launch Discount"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Discount Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as "percent" | "fixed")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "percent" ? (
            <div className="space-y-1.5">
              <Label htmlFor="percent-off">Percent Off</Label>
              <Input
                id="percent-off"
                type="number"
                min={1}
                max={100}
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                placeholder="e.g. 20"
                required
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="amount-off">Amount Off (USD)</Label>
              <Input
                id="amount-off"
                type="number"
                min={0.01}
                step={0.01}
                value={amountOff}
                onChange={(e) => setAmountOff(e.target.value)}
                placeholder="e.g. 50.00"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select
              value={duration}
              onValueChange={(v) =>
                setDuration(v as "once" | "forever" | "repeating")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
                <SelectItem value="repeating">Repeating</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {duration === "repeating" && (
            <div className="space-y-1.5">
              <Label htmlFor="duration-months">Duration (months)</Label>
              <Input
                id="duration-months"
                type="number"
                min={1}
                value={durationInMonths}
                onChange={(e) => setDurationInMonths(e.target.value)}
                placeholder="e.g. 3"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="max-redemptions">
              Max Redemptions{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="max-redemptions"
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Unlimited"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive sm:col-span-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Create Coupon
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
