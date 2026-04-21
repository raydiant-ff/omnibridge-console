"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function MonthPicker({ currentMonth }: { currentMonth: string }) {
  const router = useRouter();

  const navigate = (month: string) => {
    router.push(`/subscriptions/scrub?month=${month}`);
  };

  const prev = shiftMonth(currentMonth, -1);
  const next = shiftMonth(currentMonth, 1);

  // Don't allow navigating into the future
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isNextDisabled = next > currentMonthStr;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={() => navigate(prev)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-sm font-medium min-w-[140px] text-center">
        {formatMonthLabel(currentMonth)}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={() => navigate(next)}
        disabled={isNextDisabled}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
