import Link from "next/link";
import {
  Users,
  Plus,
  TrendingUp,
  ArrowLeftRight,
  TrendingDown,
  XCircle,
  RotateCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  { label: "Customers", href: "/subscriptions/customers", icon: Users, description: "Search and view customer details" },
  { label: "Create Subscription", href: "/subscriptions/create", icon: Plus, description: "Set up a new Stripe subscription schedule" },
  { label: "Upsell", href: "/subscriptions/upsell", icon: TrendingUp, description: "Upgrade a customer's plan" },
  { label: "Cross-sell", href: "/subscriptions/cross-sell", icon: ArrowLeftRight, description: "Add products to an existing subscription" },
  { label: "Downgrade", href: "/subscriptions/downgrade", icon: TrendingDown, description: "Reduce a customer's plan" },
  { label: "Cancellation", href: "/subscriptions/cancellation", icon: XCircle, description: "Cancel an active subscription" },
  { label: "Renewal", href: "/subscriptions/renewal", icon: RotateCw, description: "Renew an expiring subscription" },
] as const;

export default function SubscriptionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription Manager</h1>
        <p className="text-sm text-muted-foreground">
          Manage the full subscription lifecycle — create, modify, and cancel Stripe subscriptions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ label, href, icon: Icon, description }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/50">
              <CardContent className="flex flex-col gap-2 pt-6">
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-muted-foreground" />
                  <h2 className="font-semibold">{label}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
