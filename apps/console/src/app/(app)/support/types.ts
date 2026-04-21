export type SupportStatus = "open" | "pending_customer" | "pending_internal";
export type SupportPriority = "normal" | "high" | "urgent";
export type SupportChannel = "sms" | "email" | "chat";

export type SupportWorkspaceMessage = {
  id: string;
  author: string;
  role: "agent" | "customer";
  kind: "message";
  sentAt: string;
  sentAtIso: string;
  body: string;
};

export type SupportWorkspaceEvent = {
  id: string;
  kind: "event";
  sentAt: string;
  sentAtIso: string;
  title: string;
  detail: string | null;
  actor: string | null;
};

export type SupportWorkspaceTimelineItem = SupportWorkspaceMessage | SupportWorkspaceEvent;

type SupportWorkspaceConversationBase = {
  id: string;
  customer: string;
  company: string;
  linkedCustomer: boolean;
  subject: string;
  channel: SupportChannel;
  status: SupportStatus;
  priority: SupportPriority;
  assignee: string;
  waitingOn: "customer" | "internal" | "none";
  tags: string[];
};

export type SupportWorkspaceConversationSummary = SupportWorkspaceConversationBase & {
  preview: string;
  lastActivity: string;
  mrr: string;
  billing: string;
  renewal: string;
  csm: string;
};

export type SupportWorkspaceConversationDetail = SupportWorkspaceConversationBase & {
  customerIndexId: string | null;
  stripeCustomerId: string | null;
  timeline: SupportWorkspaceTimelineItem[];
};
