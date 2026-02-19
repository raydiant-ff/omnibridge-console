"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  startDate: string;
  endDate: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PickDates({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  onNext,
  onBack,
}: Props) {
  const isValid = startDate && endDate && new Date(endDate) > new Date(startDate);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Subscription Period</h2>
          <p className="text-sm text-muted-foreground">
            Choose start and end dates. Past dates are allowed for backdated subscriptions.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="start-date">Start Date &amp; Time</Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => onChangeStart(e.target.value)}
            />
            {startDate && new Date(startDate) < new Date() && (
              <p className="text-xs text-amber-600">
                This is in the past — a backdated subscription will be created.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="end-date">End Date &amp; Time</Label>
            <Input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => onChangeEnd(e.target.value)}
              min={startDate || undefined}
            />
            {startDate && endDate && new Date(endDate) <= new Date(startDate) && (
              <p className="text-xs text-destructive">
                End date must be after the start date.
              </p>
            )}
          </div>
        </div>

        {startDate && endDate && isValid && (
          <div className="rounded-lg border bg-muted/50 px-4 py-3">
            <p className="text-sm">
              <span className="font-medium">Duration:</span>{" "}
              {formatDuration(new Date(startDate), new Date(endDate))}
            </p>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext} disabled={!isValid}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(start: Date, end: Date) {
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 31) return `${days} day${days !== 1 ? "s" : ""}`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `~${months} month${months !== 1 ? "s" : ""}`;
  const years = Math.round(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years}y ${remainingMonths}m`;
}
