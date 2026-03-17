"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
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

interface SyncEvent {
  id: string;
  source: string;
  eventType: string;
  externalId: string | null;
  objectType: string | null;
  objectId: string | null;
  action: string | null;
  actorType: string | null;
  actorId: string | null;
  actorName: string | null;
  success: boolean;
  error: string | null;
  createdAt: string;
}

const SOURCE_TABS = ["all", "stripe", "salesforce", "omnibridge"] as const;
const STATUS_OPTIONS = ["all", "ok", "error"] as const;

export function SyncEventsTable({ events }: { events: SyncEvent[] }) {
  const [sourceTab, setSourceTab] = useState<string>("all");
  const [objectFilter, setObjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const objectTypes = Array.from(
    new Set(events.map((e) => e.objectType).filter(Boolean) as string[]),
  ).sort();

  const filtered = events.filter((evt) => {
    if (sourceTab !== "all" && evt.source !== sourceTab) return false;
    if (objectFilter !== "all" && evt.objectType !== objectFilter) return false;
    if (statusFilter === "ok" && !evt.success) return false;
    if (statusFilter === "error" && evt.success) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-medium">Recent Sync Events</CardTitle>
      </CardHeader>

      {/* Source Tabs */}
      <div className="border-b">
        <div className="flex">
          {SOURCE_TABS.map((tab) => {
            const count =
              tab === "all"
                ? events.length
                : events.filter((e) => e.source === tab).length;
            const isActive = sourceTab === tab;
            return (
              <button
                key={tab}
                className={`relative px-4 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSourceTab(tab)}
              >
                {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {count > 0 && (
                  <span className="ml-1.5 tabular-nums text-muted-foreground">
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Row */}
      {events.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          {objectTypes.length > 1 && (
            <>
              <span className="text-xs text-muted-foreground">Object</span>
              <Button
                variant={objectFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setObjectFilter("all")}
              >
                All
              </Button>
              {objectTypes.map((t) => (
                <Button
                  key={t}
                  variant={objectFilter === t ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setObjectFilter(t)}
                >
                  {t}
                </Button>
              ))}
              <div className="mx-1 h-4 w-px bg-border" />
            </>
          )}
          <span className="text-xs text-muted-foreground">Status</span>
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : s === "ok" ? "OK" : "Error"}
            </Button>
          ))}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filtered.length} of {events.length}
          </span>
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Object</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    {events.length === 0
                      ? "No sync events yet — trigger a webhook to start."
                      : "No events match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{evt.eventType}</span>
                    </TableCell>
                    <TableCell className={`font-mono text-xs ${evt.objectType ? "text-foreground" : "text-muted-foreground"}`}>
                      {evt.objectType
                        ? `${evt.objectType}:${evt.objectId}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{evt.action ?? "—"}</TableCell>
                    <TableCell>
                      {evt.actorName ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs">{evt.actorName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {evt.actorType}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {evt.actorType ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {evt.success ? (
                        <Badge variant="success" className="text-[10px]">
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-foreground">
                      {evt.createdAt.replace("T", " ").slice(0, 19)}
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
