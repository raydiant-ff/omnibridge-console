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

export type SupportWorkspaceConversation = {
  id: string;
  customer: string;
  company: string;
  linkedCustomer: boolean;
  subject: string;
  preview: string;
  channel: SupportChannel;
  status: SupportStatus;
  priority: SupportPriority;
  assignee: string;
  lastActivity: string;
  waitingOn: "customer" | "internal" | "none";
  tags: string[];
  mrr: string;
  billing: string;
  renewal: string;
  csm: string;
  messages: SupportWorkspaceMessage[];
  timeline: SupportWorkspaceTimelineItem[];
};
