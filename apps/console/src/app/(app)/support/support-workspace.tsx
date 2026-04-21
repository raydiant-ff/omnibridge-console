"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BrainCircuit,
  ChevronRight,
  Mail,
  MessageSquareText,
  Phone,
  Search,
  Send,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WorkspaceBody, WorkspaceContainer, WorkspaceHeader } from "@/components/shell/workspace";
import { PageHeader } from "@/components/workspace/page-header";
import { getSupportConversationDetail } from "@/lib/support/detail";
import { cn } from "@/lib/utils";
import type {
  SupportChannel,
  SupportPriority,
  SupportStatus,
  SupportWorkspaceConversationDetail,
  SupportWorkspaceConversationSummary,
  SupportWorkspaceTimelineItem,
} from "./types";

type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: "sonnet" | "opus";
};

type AgentModel = "sonnet" | "opus";

function channelLabel(channel: SupportChannel) {
  return channel === "sms" ? "SMS" : channel === "email" ? "Email" : "Chat";
}

function statusLabel(status: SupportStatus) {
  if (status === "pending_customer") return "Waiting on customer";
  if (status === "pending_internal") return "Internal follow-up";
  return "Open";
}

function statusVariant(status: SupportStatus): "warning" | "secondary" | "info" {
  if (status === "pending_customer") return "warning";
  if (status === "pending_internal") return "secondary";
  return "info";
}

function priorityVariant(priority: SupportPriority): "secondary" | "warning" | "destructive" {
  if (priority === "urgent") return "destructive";
  if (priority === "high") return "warning";
  return "secondary";
}

export function SupportWorkspace({
  initialConversations,
  initialDetail,
}: {
  initialConversations: SupportWorkspaceConversationSummary[];
  initialDetail: SupportWorkspaceConversationDetail | null;
}) {
  const sourceConversations = initialConversations;
  const hasConversations = sourceConversations.length > 0;

  const supportModes: Array<{ id: SupportChannel; label: string; count: number; icon: typeof Mail }> =
    useMemo(
      () => [
        {
          id: "sms",
          label: "SMS",
          count: sourceConversations.filter((conversation) => conversation.channel === "sms").length,
          icon: Phone,
        },
        {
          id: "chat",
          label: "Chat",
          count: sourceConversations.filter((conversation) => conversation.channel === "chat").length,
          icon: MessageSquareText,
        },
        {
          id: "email",
          label: "Email",
          count: sourceConversations.filter((conversation) => conversation.channel === "email").length,
          icon: Mail,
        },
      ],
      [sourceConversations],
    );
  const workspaceStats = useMemo(
    () => [
      {
        label: "open",
        value: String(sourceConversations.filter((conversation) => conversation.status === "open").length),
      },
      {
        label: "urgent",
        value: String(
          sourceConversations.filter((conversation) => conversation.priority === "urgent").length,
        ),
      },
      {
        label: "unassigned",
        value: String(
          sourceConversations.filter((conversation) => conversation.assignee === "Unassigned").length,
        ),
      },
    ],
    [sourceConversations],
  );

  const [selectedId, setSelectedId] = useState(
    sourceConversations.find((conversation) => conversation.channel === "sms")?.id ??
      sourceConversations[0]?.id ??
      "",
  );
  const [selectedDetail, setSelectedDetail] = useState(initialDetail);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailPending, startDetailTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<SupportChannel>("sms");
  const [visibleTimelineCount, setVisibleTimelineCount] = useState(24);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingOlderLoadRef = useRef<{ previousHeight: number } | null>(null);
  const detailCacheRef = useRef(
    new Map<string, SupportWorkspaceConversationDetail>(
      initialDetail ? [[initialDetail.id, initialDetail]] : [],
    ),
  );
  const pendingDetailIdRef = useRef<string | null>(null);

  const filteredConversations = useMemo(() => {
    return sourceConversations.filter((conversation) => {
      const matchesQuery =
        conversation.customer.toLowerCase().includes(query.toLowerCase()) ||
        conversation.company.toLowerCase().includes(query.toLowerCase()) ||
        conversation.subject.toLowerCase().includes(query.toLowerCase());
      const matchesChannel = conversation.channel === channel;
      return matchesQuery && matchesChannel;
    });
  }, [query, channel, sourceConversations]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedId) ??
    filteredConversations[0] ??
    sourceConversations[0];
  const selectedConversationId = selectedConversation?.id ?? null;
  const selectedDetailForConversation =
    selectedConversationId === selectedDetail?.id
      ? selectedDetail
      : selectedConversationId
        ? detailCacheRef.current.get(selectedConversationId) ?? null
        : null;

  useEffect(() => {
    if (!selectedConversationId) return;
    setVisibleTimelineCount(24);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !selectedDetailForConversation) return;
    const container = timelineScrollRef.current;
    if (!container) return;

    if (pendingOlderLoadRef.current) {
      const previousHeight = pendingOlderLoadRef.current.previousHeight;
      const nextHeight = container.scrollHeight;
      container.scrollTop = nextHeight - previousHeight + container.scrollTop;
      pendingOlderLoadRef.current = null;
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [selectedConversationId, selectedDetailForConversation, visibleTimelineCount]);

  useEffect(() => {
    if (!selectedConversation) {
      setSelectedDetail(null);
      setDetailError(null);
      pendingDetailIdRef.current = null;
      return;
    }

    const cachedDetail = detailCacheRef.current.get(selectedConversation.id);
    if (cachedDetail) {
      setSelectedDetail(cachedDetail);
      setDetailError(null);
      pendingDetailIdRef.current = null;
      return;
    }

    if (pendingDetailIdRef.current === selectedConversation.id) {
      return;
    }

    pendingDetailIdRef.current = selectedConversation.id;
    setSelectedDetail(null);
    setDetailError(null);

    startDetailTransition(async () => {
      try {
        const detail = await getSupportConversationDetail(selectedConversation.id);
        if (pendingDetailIdRef.current !== selectedConversation.id) return;
        if (!detail) {
          setSelectedDetail(null);
          setDetailError("This conversation could not be loaded.");
          pendingDetailIdRef.current = null;
          return;
        }
        detailCacheRef.current.set(detail.id, detail);
        setSelectedDetail(detail);
        pendingDetailIdRef.current = null;
      } catch (error) {
        if (pendingDetailIdRef.current !== selectedConversation.id) return;
        setSelectedDetail(null);
        setDetailError(
          error instanceof Error ? error.message : "Conversation details could not be loaded.",
        );
        pendingDetailIdRef.current = null;
      }
    });
  }, [selectedConversation]);

  const visibleTimeline = selectedDetailForConversation?.timeline.slice(-visibleTimelineCount) ?? [];

  function handleConversationSelect(conversationId: string) {
    setSelectedId(conversationId);

    const cachedDetail = detailCacheRef.current.get(conversationId);
    if (cachedDetail) {
      setSelectedDetail(cachedDetail);
      setDetailError(null);
      pendingDetailIdRef.current = null;
      return;
    }

    pendingDetailIdRef.current = conversationId;
    setSelectedDetail(null);
    setDetailError(null);

    startDetailTransition(async () => {
      try {
        const detail = await getSupportConversationDetail(conversationId);
        if (pendingDetailIdRef.current !== conversationId) return;
        if (!detail) {
          setSelectedDetail(null);
          setDetailError("This conversation could not be loaded.");
          pendingDetailIdRef.current = null;
          return;
        }
        detailCacheRef.current.set(detail.id, detail);
        setSelectedDetail(detail);
        pendingDetailIdRef.current = null;
      } catch (error) {
        if (pendingDetailIdRef.current !== conversationId) return;
        setSelectedDetail(null);
        setDetailError(
          error instanceof Error ? error.message : "Conversation details could not be loaded.",
        );
        pendingDetailIdRef.current = null;
      }
    });
  }

  return (
    <WorkspaceContainer variant="full" className="h-full overflow-hidden">
      <WorkspaceHeader className="gap-4">
        <PageHeader
          title="Support"
          description="Channel-specific support operations with customer context on demand."
          stats={workspaceStats}
          actions={
            <>
              <Button variant="outline" size="sm">
                <BrainCircuit className="size-4" />
                AI Agent
              </Button>
              <Button size="sm">New conversation</Button>
            </>
          }
        />
      </WorkspaceHeader>

      <WorkspaceBody className="min-h-0 gap-6 overflow-hidden">
        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(280px,2fr)_minmax(520px,4fr)_minmax(520px,4fr)]">
          <div className="flex min-h-0 flex-col gap-6">
            <SupportModeNav
              channel={channel}
              onChannelChange={setChannel}
              supportModes={supportModes}
              disabled={!hasConversations}
            />

            <Card className="min-h-0 flex-1 gap-0 py-0">
              <CardHeader className="border-b border-border px-5 py-4">
                <CardTitle className="text-base">Conversations</CardTitle>
                <CardAction>
                  <Badge variant="outline">{filteredConversations.length}</Badge>
                </CardAction>
                <CardDescription>
                  Filtered by channel so agents stay in one operating mode.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${channelLabel(channel).toLowerCase()} conversations...`}
                    className="pl-9"
                    disabled={!hasConversations}
                  />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                  <div className="space-y-3 pr-1">
                    {!hasConversations ? (
                      <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/10 px-4 py-5">
                        <p className="text-sm font-semibold text-foreground">
                          No conversations in your assigned inboxes yet
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Support will appear here once conversations are synced into an inbox your account can access.
                        </p>
                      </div>
                    ) : null}
                    {filteredConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => handleConversationSelect(conversation.id)}
                        className={cn(
                          "block w-full max-w-full overflow-hidden rounded-2xl border px-4 py-4 text-left transition-colors",
                          selectedConversation?.id === conversation.id
                            ? "border-primary/25 bg-primary/5"
                            : "border-border/70 hover:bg-accent/35",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="max-w-full overflow-hidden text-pretty break-words text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
                                  {conversation.customer}
                                </p>
                                {conversation.company ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {conversation.company}
                                  </p>
                                ) : null}
                              </div>
                              <Badge variant="outline" className="shrink-0">
                                {channelLabel(conversation.channel)}
                              </Badge>
                            </div>
                            <p className="mt-3 max-w-full overflow-hidden text-pretty break-words pr-1 text-sm font-medium leading-6 text-foreground [overflow-wrap:anywhere]">
                              {conversation.subject}
                            </p>
                            <p className="mt-1 max-w-full overflow-hidden text-pretty break-words pr-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                              {conversation.preview}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant={priorityVariant(conversation.priority)}>
                            {conversation.priority}
                          </Badge>
                          <Badge variant={statusVariant(conversation.status)}>
                            {statusLabel(conversation.status)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span className="min-w-0 truncate">
                            Owner: {conversation.assignee}
                          </span>
                          <span className="shrink-0">{conversation.lastActivity}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex min-h-0 flex-col gap-6">
            <Card className="min-h-0 flex-1 gap-0 py-0">
              {selectedConversation ? (
                <>
                  <CardHeader className="border-b border-border px-5 py-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="size-10 border border-border/70">
                        <AvatarFallback>
                          {selectedConversation.customer
                            .split(" ")
                            .map((chunk) => chunk[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="max-w-full text-balance break-words text-lg leading-tight [overflow-wrap:anywhere]">
                          {selectedConversation.customer}
                        </CardTitle>
                        <CardDescription className="mt-1 max-w-full text-pretty break-words text-sm leading-6 [overflow-wrap:anywhere]">
                          {selectedConversation.subject}
                        </CardDescription>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {selectedConversation.linkedCustomer
                            ? selectedConversation.company
                            : `${channelLabel(selectedConversation.channel)} conversation`}
                        </p>
                        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant={priorityVariant(selectedConversation.priority)}>
                            {selectedConversation.priority}
                          </Badge>
                          <Badge variant={statusVariant(selectedConversation.status)}>
                            {statusLabel(selectedConversation.status)}
                          </Badge>
                          <Badge variant="outline" className="max-w-full truncate">
                            Assigned to {selectedConversation.assignee}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col px-0">
                    <div
                      ref={timelineScrollRef}
                      className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
                      onScroll={(event) => {
                        const target = event.currentTarget;
                        if (
                          target.scrollTop < 120 &&
                          selectedDetailForConversation &&
                          visibleTimelineCount < selectedDetailForConversation.timeline.length
                        ) {
                          pendingOlderLoadRef.current = {
                            previousHeight: target.scrollHeight,
                          };
                          setVisibleTimelineCount((count) =>
                            Math.min(count + 20, selectedDetailForConversation.timeline.length),
                          );
                        }
                      }}
                    >
                      <div className="space-y-5">
                        {selectedDetailForConversation ? (
                          <>
                            {visibleTimeline.map((item) =>
                              item.kind === "message" ? (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "max-w-[82%] rounded-2xl border px-4 py-3",
                                    item.role === "agent"
                                      ? "ml-auto border-primary/20 bg-primary/5"
                                      : "border-border/70 bg-background",
                                  )}
                                >
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-foreground">
                                      {item.author}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{item.sentAt}</p>
                                  </div>
                                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                                    {item.body}
                                  </p>
                                </div>
                              ) : (
                                <TimelineEventItem key={item.id} event={item} />
                              ),
                            )}
                          </>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/10 px-4 py-5">
                            <p className="text-sm font-semibold text-foreground">
                              {detailError ?? "Loading conversation activity"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {detailError
                                ? "Try another thread or refresh the workspace."
                                : isDetailPending
                                  ? "Fetching the latest timeline, messages, and events for this thread."
                                  : "Conversation details will appear here once the thread is ready."}
                            </p>
                          </div>
                        )}
                        {selectedDetailForConversation &&
                        visibleTimelineCount < selectedDetailForConversation.timeline.length ? (
                          <div className="flex justify-center pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setVisibleTimelineCount((count) =>
                                  Math.min(
                                    count + 20,
                                    selectedDetailForConversation.timeline.length,
                                  ),
                                )
                              }
                            >
                              Load more activity
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedConversation.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Textarea
                        placeholder="Outbound messaging is not wired up yet — this composer is disabled."
                        className="min-h-24 resize-none"
                        disabled
                        aria-disabled
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          Waiting on{" "}
                          <span className="font-medium text-foreground">
                            {selectedConversation.waitingOn === "none"
                              ? "no one"
                              : selectedConversation.waitingOn}
                          </span>
                        </p>
                        <TooltipProvider delayDuration={150}>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button variant="outline" size="sm" disabled aria-disabled>
                                    Internal note
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Outbound support messaging is not wired up yet.
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button size="sm" disabled aria-disabled>
                                    <Send className="size-4" />
                                    Send reply
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Outbound support messaging is not wired up yet.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardContent>
                </>
              ) : (
                <EmptyConversationState />
              )}
            </Card>

          </div>

          <div className="flex min-h-0 flex-col gap-6">
            <Card className="min-h-0 flex-1 gap-0 py-0">
              {selectedConversation ? (
                <InlineSupportMcpPanel conversation={selectedConversation} />
              ) : (
                <EmptySidePanel title="AI Agent" description="Select a conversation to ask the agent for help." />
              )}
            </Card>
            <Card className="min-h-0 flex-1 gap-0 py-0">
              {selectedConversation ? (
                <InlineSupportContextPanel conversation={selectedConversation} />
              ) : (
                <EmptySidePanel title="Customer 360" description="Customer context will appear here once you open a conversation." />
              )}
            </Card>
          </div>
        </div>
      </WorkspaceBody>
    </WorkspaceContainer>
  );
}

function SupportModeNav({
  channel,
  onChannelChange,
  supportModes,
  disabled,
}: {
  channel: SupportChannel;
  onChannelChange: (value: SupportChannel) => void;
  supportModes: Array<{ id: SupportChannel; label: string; count: number; icon: typeof Mail }>;
  disabled?: boolean;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle className="text-base">Support Mode</CardTitle>
        <CardDescription>
          Switch channel without leaving the workspace.
        </CardDescription>
      </CardHeader>
        <CardContent className="px-3 py-3">
          <div className="space-y-2">
            {supportModes.map((mode) => {
              const Icon = mode.icon;
              const active = mode.id === channel;
              return (
                <button
                  key={mode.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChannelChange(mode.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                    disabled
                      ? "cursor-not-allowed opacity-60"
                      : "",
                    active
                      ? "border-primary/25 bg-primary/5"
                      : "border-border/70 hover:bg-accent/35",
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {mode.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {mode.count} active
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
  );
}

function EmptyConversationState() {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-dashed border-border/80 bg-secondary/10 px-6 py-8 text-center">
        <p className="text-base font-semibold text-foreground">No conversation selected</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Once a conversation is available in one of your assigned inboxes, the thread and reply tools will appear here.
        </p>
      </div>
    </div>
  );
}

function EmptySidePanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full overflow-hidden">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="p-5">
        <div className="rounded-xl border border-dashed border-border/80 bg-secondary/10 px-4 py-5">
          <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
        </div>
      </div>
    </div>
  );
}

function TimelineEventItem({ event }: { event: Extract<SupportWorkspaceTimelineItem, { kind: "event" }> }) {
  return (
    <div className="flex items-center justify-center">
      <div className="max-w-[420px] rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-foreground">
          {event.title}
          {event.actor ? ` by ${event.actor}` : ""}
        </p>
        {event.detail ? (
          <p className="mt-1 max-w-[420px] text-sm text-muted-foreground">{event.detail}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">{event.sentAt}</p>
      </div>
    </div>
  );
}
function InlineSupportContextPanel({
  conversation,
}: {
  conversation: SupportWorkspaceConversationSummary;
}) {
  if (!conversation.linkedCustomer) {
    return (
      <div className="h-full overflow-hidden">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle className="text-base">Customer 360</CardTitle>
          <CardDescription>
            Omni customer context appears here after this conversation is linked to a matched
            customer.
          </CardDescription>
        </CardHeader>
        <div className="p-5">
          <div className="rounded-xl border border-dashed border-border/80 bg-secondary/10 px-4 py-5">
            <p className="text-sm font-semibold text-foreground">No matched customer yet</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This panel intentionally stays empty until Omni can match the thread to a real
              customer account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle className="text-base">Customer 360</CardTitle>
        <CardDescription>
          Account, billing, and lifecycle context for {conversation.company}.
        </CardDescription>
      </CardHeader>
      <ScrollArea className="min-h-0 h-full">
        <div className="space-y-5 p-5">
          <div className="rounded-xl border border-border/70 bg-secondary/10 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Account
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">{conversation.company}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DenseInfoRow label="Customer" value={conversation.customer} />
              <DenseInfoRow label="CSM" value={conversation.csm} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CompactMetric label="MRR" value={conversation.mrr} />
            <CompactMetric label="Billing" value={conversation.billing} />
            <CompactMetric label="Renewal" value={conversation.renewal} />
            <CompactMetric label="Assignee" value={conversation.assignee} />
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Operational context
            </p>
            <div className="grid gap-2">
              <DenseInfoRow
                label="Waiting on"
                value={conversation.waitingOn === "none" ? "No blocker" : conversation.waitingOn}
              />
              <DenseInfoRow label="Thread status" value={statusLabel(conversation.status)} />
              <DenseInfoRow
                label="Support tags"
                value={conversation.tags.length > 0 ? conversation.tags.join(", ") : "No tags"}
              />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function InlineSupportMcpPanel({
  conversation,
}: {
  conversation: SupportWorkspaceConversationSummary;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<AgentModel>("sonnet");

  useEffect(() => {
    setDraft("");
    setError(null);
    setMessages([]);
  }, [conversation.id]);

  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");

  async function askAgent() {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;

    const userMessage: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/support/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          prompt: trimmed,
          model,
        }),
      });

      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
        model?: string;
      };
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "The AI Agent could not complete that request.");
      }
      const reply = payload.reply;

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
          model,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI Agent request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="h-full overflow-hidden">
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base">AI Agent</CardTitle>
            <CardDescription>
              Ask for operational help while keeping the customer thread separate.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-secondary/30 p-1">
            <button
              type="button"
              onClick={() => setModel("sonnet")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                model === "sonnet"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sonnet
            </button>
            <button
              type="button"
              onClick={() => setModel("opus")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                model === "opus"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Opus
            </button>
          </div>
        </div>
      </CardHeader>
      <ScrollArea className="min-h-0 h-full">
        <div className="flex h-full min-h-0 flex-col p-5">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/10 px-4 py-5">
                <p className="text-sm font-semibold text-foreground">Ready to help</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Ask the agent to summarize risk, recommend next steps, or draft a customer-safe response for this thread.
                </p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  Current model: {model === "sonnet" ? "Claude Sonnet 4.6" : "Claude Opus 4.6"}
                </p>
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-2xl border px-4 py-3",
                  message.role === "assistant"
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/70 bg-background",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {message.role === "assistant" ? "AI Agent" : "You"}
                  </p>
                  {message.role === "assistant" && message.model ? (
                    <Badge variant="outline" className="text-[11px]">
                      {message.model === "sonnet" ? "Sonnet" : "Opus"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {message.content}
                </p>
              </div>
            ))}
            {isLoading ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">AI Agent</p>
                  <Badge variant="outline" className="text-[11px]">
                    {model === "sonnet" ? "Sonnet" : "Opus"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Thinking…</p>
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex-1" />
          <div className="space-y-3 border-t border-border pt-4">
            <Textarea
              placeholder="Ask the agent to investigate, summarize, or suggest the next operational step..."
              className="min-h-28 resize-none"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={askAgent} disabled={isLoading || draft.trim().length === 0}>
                <BrainCircuit className="size-4" />
                Ask agent
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!lastAssistantMessage}
                onClick={async () => {
                  if (!lastAssistantMessage) return;
                  await navigator.clipboard.writeText(lastAssistantMessage.content);
                }}
              >
                Copy response
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DenseInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
