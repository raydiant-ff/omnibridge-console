"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SyncJob {
  id: string;
  jobType: string;
  status: string;
  cursor: string | null;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsErrored: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "completed", "running", "failed", "pending"] as const;

export function SyncJobsTable({ jobs }: { jobs: SyncJob[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const jobTypes = Array.from(new Set(jobs.map((j) => j.jobType)));
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = jobs.filter((job) => {
    if (statusFilter !== "all" && job.status !== statusFilter) return false;
    if (typeFilter !== "all" && job.jobType !== typeFilter) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-medium">Recent Sync Jobs</CardTitle>
        <CardDescription className="text-xs">
          {jobs.length === 0
            ? "No sync jobs recorded yet"
            : `${filtered.length} of ${jobs.length} jobs`}
        </CardDescription>
      </CardHeader>

      {/* Filters */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <span className="text-xs text-muted-foreground">Status</span>
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : s}
            </Button>
          ))}

          {jobTypes.length > 1 && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">Type</span>
              <Button
                variant={typeFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setTypeFilter("all")}
              >
                All
              </Button>
              {jobTypes.map((t) => (
                <Button
                  key={t}
                  variant={typeFilter === t ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 px-2 font-mono text-xs"
                  onClick={() => setTypeFilter(t)}
                >
                  {t}
                </Button>
              ))}
            </>
          )}
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    {jobs.length === 0
                      ? "No sync jobs yet — run a backfill or wait for cron."
                      : "No jobs match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.jobType}</TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {job.recordsProcessed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {job.recordsCreated}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {job.recordsUpdated}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {job.recordsErrored > 0 ? (
                        <span className="text-destructive">{job.recordsErrored}</span>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell className={`text-xs ${job.startedAt && job.completedAt ? "text-foreground" : "text-muted-foreground"}`}>
                      {job.startedAt && job.completedAt
                        ? `${((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000).toFixed(1)}s`
                        : "—"}
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-xs ${job.startedAt ? "text-foreground" : "text-muted-foreground"}`}>
                      {job.startedAt
                        ? job.startedAt.replace("T", " ").slice(0, 19)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "success"
      : status === "running"
        ? "info"
        : status === "failed"
          ? "destructive"
          : "secondary";

  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
  );
}
