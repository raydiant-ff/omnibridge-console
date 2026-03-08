"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./tabs/overview-tab";
import { StripeTab } from "./tabs/stripe-tab";
import { SalesforceTab } from "./tabs/salesforce-tab";
import { WorkItemsTab } from "./tabs/work-items-tab";
import { AuditTab } from "./tabs/audit-tab";
import type { CustomerIndex } from "@omnibridge/db";
import type { MockStripeData, MockSalesforceData } from "@/lib/mock-data";

interface Props {
  customer: CustomerIndex;
  stripeData: MockStripeData | null;
  salesforceData: MockSalesforceData | null;
  workItems: WorkItemWithRelations[];
  auditLogs: AuditLogWithActor[];
  mockFlags: { stripe: boolean; salesforce: boolean };
}

export interface WorkItemWithRelations {
  id: string;
  type: string;
  status: string;
  payloadJson: unknown;
  createdById: string;
  assignedToId: string | null;
  customerId: string | null;
  dueAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: { id: string; name: string | null; email: string };
  assignedTo: { id: string; name: string | null; email: string } | null;
}

export interface AuditLogWithActor {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  payloadJson: unknown;
  customerId: string | null;
  createdAt: Date | string;
  actor: { id: string; name: string | null; email: string };
}

export function CustomerTabs({
  customer,
  stripeData,
  salesforceData,
  workItems,
  auditLogs,
  mockFlags,
}: Props) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="stripe">Stripe</TabsTrigger>
        <TabsTrigger value="salesforce">Salesforce</TabsTrigger>
        <TabsTrigger value="work-items">
          Work Items
          {workItems.length > 0 && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none">
              {workItems.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        <OverviewTab customer={customer} stripeData={stripeData} salesforceData={salesforceData} />
      </TabsContent>

      <TabsContent value="stripe" className="mt-6">
        <StripeTab data={stripeData} isMock={mockFlags.stripe} />
      </TabsContent>

      <TabsContent value="salesforce" className="mt-6">
        <SalesforceTab data={salesforceData} isMock={mockFlags.salesforce} />
      </TabsContent>

      <TabsContent value="work-items" className="mt-6">
        <WorkItemsTab items={workItems} />
      </TabsContent>

      <TabsContent value="audit" className="mt-6">
        <AuditTab logs={auditLogs} />
      </TabsContent>
    </Tabs>
  );
}
