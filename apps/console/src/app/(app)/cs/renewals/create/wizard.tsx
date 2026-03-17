"use client";

import { RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  QuoteWizard,
  type QuoteWizardState,
} from "@/app/(app)/quotes/create/wizard";

interface Props {
  initialState: Partial<QuoteWizardState>;
  subscriptionId: string;
  customerName: string;
}

export function RenewalWizard({ initialState, subscriptionId, customerName }: Props) {
  const startStep = initialState.customer ? 2 : 0;

  return (
    <QuoteWizard
      initialState={initialState}
      initialStep={startStep}
      storageKey={`renewal-wizard-${subscriptionId}`}
      badge={
        <Badge
          variant="secondary"
          className="mr-2 gap-1 text-xs"
        >
          <RotateCw className="size-3" />
          Renewal — {customerName}
        </Badge>
      }
    />
  );
}
