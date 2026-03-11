import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SubscriptionsDashboard } from "./dashboard-section";

const QUICK_ACTIONS = [
  { label: "Create Subscription", href: "/subscriptions/create", icon: Plus },
] as const;

export default function SubscriptionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription Manager</h1>
        <p className="text-sm text-muted-foreground">
          Manage the full subscription lifecycle — create, modify, and cancel Stripe subscriptions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="transition-colors hover:border-primary/50 hover:bg-muted/50">
              <CardContent className="flex items-center gap-1.5 px-3 py-2">
                <Icon className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium whitespace-nowrap">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Suspense fallback={<div className="animate-pulse bg-muted h-64 rounded" />}>
        <SubscriptionsDashboard />
      </Suspense>
    </div>
  );
}
