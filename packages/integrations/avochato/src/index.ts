export class AvochatoApiError extends Error {
  statusCode: number;
  requestId: string | null;

  constructor(message: string, statusCode: number, requestId: string | null = null) {
    super(message);
    this.name = "AvochatoApiError";
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

export type AvochatoChannel = "sms" | "chat" | "email";

export interface AvochatoCredentials {
  authId: string;
  authSecret: string;
  subdomain?: string;
}

export interface AvochatoAccount {
  id: string;
  subdomain: string;
  name: string;
  phone: string | null;
  created_at: number | string;
  tcr_campaign_id: string | null;
}

export interface AvochatoUser {
  id: string;
  email: string;
  name: string;
  image_url: string | null;
  avobot_id: string | null;
}

export interface AvochatoWhoAmIResponse {
  account: AvochatoAccount;
  user: AvochatoUser;
  origin: string;
  created_at: string;
}

export interface AvochatoContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  opted_out: boolean;
  double_opted_in: boolean;
  muted: boolean;
  blocked: boolean;
  salesforce_object_type: string | null;
  salesforce_object_id: string | null;
  priority: number | null;
  user_id: string | null;
  current_owner: string | null;
  due_for_compliance: boolean | null;
}

export interface AvochatoTicket {
  id: string;
  uuid?: string;
  contact: string | null;
  user_id: string | null;
  unaddressed: boolean;
  status: string;
  origin: string | null;
  created_at: number | string;
  updated_at?: number | string;
}

export interface AvochatoMessage {
  uuid?: string;
  account_id?: string | null;
  id: string;
  contact_id?: string | null;
  ticket_id?: string | null;
  sender_id?: string | null;
  sender_type?: string | null;
  from: string | null;
  to?: string | null;
  direction: "in" | "out" | string;
  origin: string | null;
  message: string | null;
  status: string | null;
  error_code?: number | null;
  error_description?: string | null;
  created_at: number | string;
  sent_at?: number | string | null;
  event_id?: string | null;
  external_id?: string | null;
  element_id?: string | null;
  element_type?: string | null;
}

export interface AvochatoTicketEvent {
  id?: string;
  event_id?: string | null;
  ticket_id?: string | null;
  user_id?: string | null;
  sender_id?: string | null;
  sender_tag?: string | null;
  element_id?: string | null;
  element_type?: string | null;
  status?: string | null;
  sent_at?: number | string | null;
  event_type?: string | null;
  created_at: number | string;
  payload?: Record<string, unknown> | null;
  [key: string]: unknown;
}

type AvochatoEnvelope<T, Key extends string> = {
  status: number;
  data: Record<Key, T>;
  page?: number;
  limit?: number;
};

type QueryValue = string | number | boolean | null | undefined;

function getCredentialsFromEnv(): AvochatoCredentials {
  const authId = process.env.AVOCHATO_AUTH_ID;
  const authSecret = process.env.AVOCHATO_AUTH_SECRET;

  if (!authId || !authSecret) {
    throw new Error("AVOCHATO_AUTH_ID and AVOCHATO_AUTH_SECRET must be set");
  }

  return {
    authId,
    authSecret,
    subdomain: process.env.AVOCHATO_DEFAULT_SUBDOMAIN ?? undefined,
  };
}

function withAuth(
  credentials: AvochatoCredentials,
  values: Record<string, QueryValue>,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("auth_id", credentials.authId);
  params.set("auth_secret", credentials.authSecret);
  if (credentials.subdomain) params.set("subdomain", credentials.subdomain);

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  return params;
}

async function avochatoRequest<T, Key extends string>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT";
    query?: Record<string, QueryValue>;
    body?: Record<string, QueryValue>;
    credentials?: AvochatoCredentials;
  } = {},
): Promise<AvochatoEnvelope<T, Key>> {
  const credentials = options.credentials ?? getCredentialsFromEnv();
  const method = options.method ?? "GET";
  const query = withAuth(credentials, options.query ?? {});
  const url = new URL(`https://www.avochato.com${path}`);

  if (method === "GET") {
    url.search = query.toString();
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      Host: "www.avochato.com",
    },
    body:
      method === "GET"
        ? undefined
        : JSON.stringify(
            Object.fromEntries(
              withAuth(credentials, options.body ?? {}).entries(),
            ),
          ),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AvochatoApiError(
      `Avochato API error: ${response.status} ${text}`,
      response.status,
      response.headers.get("X-Request-Id"),
    );
  }

  return (await response.json()) as AvochatoEnvelope<T, Key>;
}

export function getAvochatoCredentials(): AvochatoCredentials {
  return getCredentialsFromEnv();
}

export async function whoAmI(credentials?: AvochatoCredentials) {
  const response = await avochatoRequest<AvochatoWhoAmIResponse, "account" | "user" | "origin" | "created_at">(
    "/v1/whoami",
    { credentials },
  );

  return response.data as unknown as AvochatoWhoAmIResponse;
}

export async function listAccounts(credentials?: AvochatoCredentials) {
  const response = await avochatoRequest<AvochatoAccount[], "accounts">("/v1/accounts", {
    credentials,
  });
  return response.data.accounts;
}

export async function listUsers(credentials?: AvochatoCredentials, page = 1) {
  const response = await avochatoRequest<AvochatoUser[], "users">("/v1/users", {
    credentials,
    query: { page },
  });
  return response.data.users;
}

export async function listTickets(
  credentials?: AvochatoCredentials,
  query: { page?: number; search?: string } = {},
) {
  const response = await avochatoRequest<AvochatoTicket[], "tickets">("/v1/tickets", {
    credentials,
    query: {
      page: query.page,
      query: query.search,
    },
  });
  return response.data.tickets;
}

export async function fetchTickets(
  ids: string | string[],
  credentials?: AvochatoCredentials,
  page = 1,
) {
  const resolvedIds = Array.isArray(ids) ? ids.join(",") : ids;
  const response = await avochatoRequest<AvochatoTicket[], "tickets">(
    `/v1/tickets/${resolvedIds}`,
    {
      credentials,
      query: { page },
    },
  );
  return response.data.tickets;
}

export async function fetchTicketEvents(
  ids: string | string[],
  credentials?: AvochatoCredentials,
  page = 1,
) {
  const resolvedIds = Array.isArray(ids) ? ids.join(",") : ids;
  const response = await avochatoRequest<AvochatoTicketEvent[], "events">(
    `/v1/tickets/${resolvedIds}/events`,
    {
      credentials,
      query: { page },
    },
  );
  return response.data.events;
}

export async function searchMessages(
  credentials?: AvochatoCredentials,
  query: {
    page?: number;
    search?: string;
    direction?: "in" | "out";
    status?: string;
    contactId?: string;
    ticketId?: string;
    createdAtFrom?: number;
    createdAtTo?: number;
  } = {},
) {
  const response = await avochatoRequest<AvochatoMessage[], "messages">("/v1/messages", {
    credentials,
    query: {
      page: query.page,
      query: query.search,
      direction: query.direction,
      status: query.status,
      contact_id: query.contactId,
      ticket_id: query.ticketId,
      "created_at[from]": query.createdAtFrom,
      "created_at[to]": query.createdAtTo,
    },
  });
  return response.data.messages;
}

export async function upsertContact(
  input: {
    phone: string;
    name?: string;
    email?: string;
    company?: string;
    optedOut?: boolean;
    doubleOptedIn?: boolean;
    muted?: boolean;
    blocked?: boolean;
    priority?: number;
  },
  credentials?: AvochatoCredentials,
) {
  const response = await avochatoRequest<AvochatoContact, "contact">("/v1/contacts", {
    method: "POST",
    credentials,
    body: {
      phone: input.phone,
      name: input.name,
      email: input.email,
      company: input.company,
      opted_out: input.optedOut,
      double_opted_in: input.doubleOptedIn,
      muted: input.muted,
      blocked: input.blocked,
      priority: input.priority,
    },
  });
  return response.data.contact;
}

export async function sendMessage(
  input: {
    phone: string;
    message: string;
    from?: string;
    markAddressed?: boolean;
    tags?: string[];
    statusCallback?: string;
    sendAsUserEmail?: string;
    sendAsUserId?: string;
  },
  credentials?: AvochatoCredentials,
) {
  const response = await avochatoRequest<AvochatoMessage, "message">("/v1/messages", {
    method: "POST",
    credentials,
    body: {
      phone: input.phone,
      message: input.message,
      from: input.from,
      mark_addressed: input.markAddressed,
      tags: input.tags?.join(", "),
      status_callback: input.statusCallback,
      send_as_user_email: input.sendAsUserEmail,
      send_as_user_id: input.sendAsUserId,
    },
  });
  return response.data.message;
}

export async function updateTicketAssignmentByUserEmail(
  ids: string | string[],
  userEmail: string,
  credentials?: AvochatoCredentials,
) {
  const resolvedIds = Array.isArray(ids) ? ids.join(",") : ids;
  return avochatoRequest<unknown, never>(`/v1/tickets/${resolvedIds}`, {
    method: "PUT",
    credentials,
    body: { user_email: userEmail },
  });
}

export async function updateTicketAssignmentByUserId(
  ids: string | string[],
  userId: string,
  credentials?: AvochatoCredentials,
) {
  const resolvedIds = Array.isArray(ids) ? ids.join(",") : ids;
  return avochatoRequest<unknown, never>(`/v1/tickets/${resolvedIds}`, {
    method: "PUT",
    credentials,
    body: { user_id: userId },
  });
}

export async function updateTicketStatus(
  ids: string | string[],
  status: string,
  credentials?: AvochatoCredentials,
) {
  const resolvedIds = Array.isArray(ids) ? ids.join(",") : ids;
  return avochatoRequest<unknown, never>(`/v1/tickets/${resolvedIds}/status`, {
    method: "PUT",
    credentials,
    body: { status },
  });
}
