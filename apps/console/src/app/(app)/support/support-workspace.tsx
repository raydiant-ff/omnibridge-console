"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { WorkspaceBody, WorkspaceContainer, WorkspaceHeader } from "@/components/shell/workspace";
import { PageHeader } from "@/components/workspace/page-header";
import { cn } from "@/lib/utils";
import type {
  SupportChannel,
  SupportPriority,
  SupportStatus,
  SupportWorkspaceConversation,
  SupportWorkspaceTimelineItem,
} from "./types";

type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: "sonnet" | "opus";
};

type AgentModel = "sonnet" | "opus";

const fallbackConversations: SupportWorkspaceConversation[] = [
  {
    id: "conv-1024",
    customer: "Taylor Reed",
    company: "Northstar Marketing",
    linkedCustomer: true,
    subject: "SMS opt-in issue after billing retry",
    preview:
      "Customers can reply STOP, but the number is still receiving retries from the billing flow.",
    channel: "sms",
    status: "open",
    priority: "urgent",
    assignee: "Support Agent",
    lastActivity: "2m ago",
    waitingOn: "internal",
    tags: ["billing", "avochato", "escalated"],
    mrr: "$2.1k",
    billing: "2 invoices past due",
    renewal: "Apr 14",
    csm: "Ali Aziz",
    messages: [
      {
        id: "m-1",
        author: "Taylor Reed",
        role: "customer",
        kind: "message",
        sentAt: "9:03 AM",
        sentAtIso: "2026-03-25T09:03:00.000Z",
        body:
          "Our customer replied STOP to the reminder thread, but Avochato is still sending the retry nudges from billing. Can someone help today?",
      },
      {
        id: "m-2",
        author: "Support Agent",
        role: "agent",
        kind: "message",
        sentAt: "9:10 AM",
        sentAtIso: "2026-03-25T09:10:00.000Z",
        body:
          "Thanks, we’re tracing whether the retry event is coming from Stripe or from our sync state. I’m looping in engineering and will update this thread shortly.",
      },
      {
        id: "m-3",
        author: "Taylor Reed",
        role: "customer",
        kind: "message",
        sentAt: "9:18 AM",
        sentAtIso: "2026-03-25T09:18:00.000Z",
        body:
          "Appreciate it. The team is nervous because these customers are already sensitive about collections.",
      },
    ],
    timeline: [],
  },
  {
    id: "conv-1023",
    customer: "Morgan Hale",
    company: "Summit Commerce",
    linkedCustomer: true,
    subject: "Invoice PDF missing Salesforce account owner",
    preview:
      "The invoice PDF no longer includes the account owner name after the last quote sync.",
    channel: "email",
    status: "pending_customer",
    priority: "high",
    assignee: "Annette Broussard",
    lastActivity: "34m ago",
    waitingOn: "customer",
    tags: ["invoice", "salesforce"],
    mrr: "$980",
    billing: "Open invoice $4.8k",
    renewal: "Apr 02",
    csm: "Annette Broussard",
    messages: [
      {
        id: "m-4",
        author: "Morgan Hale",
        role: "customer",
        kind: "message",
        sentAt: "8:11 AM",
        sentAtIso: "2026-03-25T08:11:00.000Z",
        body:
          "Our finance team noticed the account owner field disappeared from the invoice PDF. Was that removed intentionally?",
      },
      {
        id: "m-5",
        author: "Annette Broussard",
        role: "agent",
        kind: "message",
        sentAt: "8:37 AM",
        sentAtIso: "2026-03-25T08:37:00.000Z",
        body:
          "We’re checking the quote and invoice mapping now. Could you send one affected invoice number so we can verify the payload?",
      },
    ],
    timeline: [],
  },
  {
    id: "conv-1022",
    customer: "Riley Chen",
    company: "Pioneer Labs",
    linkedCustomer: true,
    subject: "Live chat from upgrade page",
    preview:
      "Customer wants to know why the contract and subscription dates do not match after amendment.",
    channel: "chat",
    status: "pending_internal",
    priority: "normal",
    assignee: "Blake Reeves",
    lastActivity: "1h ago",
    waitingOn: "internal",
    tags: ["contract", "subscription"],
    mrr: "$640",
    billing: "Healthy",
    renewal: "Mar 31",
    csm: "Blake Reeves",
    messages: [
      {
        id: "m-6",
        author: "Riley Chen",
        role: "customer",
        kind: "message",
        sentAt: "7:49 AM",
        sentAtIso: "2026-03-25T07:49:00.000Z",
        body:
          "Hey team, our amendment was countersigned but the subscription says one thing and the contract says another. Which one is supposed to govern?",
      },
      {
        id: "m-7",
        author: "Blake Reeves",
        role: "agent",
        kind: "message",
        sentAt: "8:02 AM",
        sentAtIso: "2026-03-25T08:02:00.000Z",
        body:
          "I’m checking the contract mirror and Stripe subscription timeline. I’ll confirm which date is canonical before you send anything to your customer.",
      },
    ],
    timeline: [],
  },
];

for (const conversation of fallbackConversations) {
  if (conversation.timeline.length === 0) {
    conversation.timeline = [...conversation.messages];
  }
}

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
}: {
  initialConversations?: SupportWorkspaceConversation[];
}) {
  const sourceConversations =
    initialConversations && initialConversations.length > 0
      ? initialConversations
      : fallbackConversations;

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

  const [selectedId, setSelectedId] = useState(sourceConversations[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<SupportChannel>("sms");
  const [visibleTimelineCount, setVisibleTimelineCount] = useState(24);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingOlderLoadRef = useRef<{ previousHeight: number } | null>(null);

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

  useEffect(() => {
    setVisibleTimelineCount(24);
  }, [selectedConversation.id]);

  useEffect(() => {
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
  }, [selectedConversation.id, visibleTimelineCount]);

  const visibleTimeline = selectedConversation.timeline.slice(-visibleTimelineCount);

  return (
    <WorkspaceContainer variant="full" className="h-full overflow-hidden">
      <WorkspaceHeader className="gap-4">
        <PageHeader
          title="Support"
          description="Channel-specific support operations with customer context on demand."
          stats={[
            { label: "open", value: "18" },
            { label: "urgent", value: "3" },
            { label: "unassigned", value: "6" },
          ]}
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
                  />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                  <div className="space-y-3 pr-1">
                    {filteredConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setSelectedId(conversation.id)}
                        className={cn(
                          "block w-full max-w-full overflow-hidden rounded-2xl border px-4 py-4 text-left transition-colors",
                          selectedConversation.id === conversation.id
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
                      visibleTimelineCount < selectedConversation.timeline.length
                    ) {
                      pendingOlderLoadRef.current = {
                        previousHeight: target.scrollHeight,
                      };
                      setVisibleTimelineCount((count) =>
                        Math.min(count + 20, selectedConversation.timeline.length),
                      );
                    }
                  }}
                >
                  <div className="space-y-5">
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
                            <p className="text-sm font-semibold text-foreground">{item.author}</p>
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
                    {visibleTimelineCount < selectedConversation.timeline.length ? (
                      <div className="flex justify-center pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setVisibleTimelineCount((count) =>
                              Math.min(count + 20, selectedConversation.timeline.length),
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
                    placeholder="Reply to the customer, add an internal update, or draft a macro-assisted response..."
                    className="min-h-24 resize-none"
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
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        Internal note
                      </Button>
                      <Button size="sm">
                        <Send className="size-4" />
                        Send reply
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="flex min-h-0 flex-col gap-6">
            <Card className="min-h-0 flex-1 gap-0 py-0">
              <InlineSupportMcpPanel conversation={selectedConversation} />
            </Card>
            <Card className="min-h-0 flex-1 gap-0 py-0">
              <InlineSupportContextPanel conversation={selectedConversation} />
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
}: {
  channel: SupportChannel;
  onChannelChange: (value: SupportChannel) => void;
  supportModes: Array<{ id: SupportChannel; label: string; count: number; icon: typeof Mail }>;
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
                  onClick={() => onChannelChange(mode.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
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
function InlineSupportContextPanel({ conversation }: { conversation: SupportWorkspaceConversation }) {
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
              <DenseInfoRow label="Past-due pressure" value="2 unresolved invoices" />
              <DenseInfoRow label="Renewal handoff" value="Inside current renewal month" />
              <DenseInfoRow label="Support tags" value={conversation.tags.join(", ")} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function InlineSupportMcpPanel({ conversation }: { conversation: SupportWorkspaceConversation }) {
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
