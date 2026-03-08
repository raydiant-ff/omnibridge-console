const BASE_URL = "https://api.pandadoc.com/public/v1";

function getApiKey(): string {
  const key = process.env.PANDADOC_API_KEY;
  if (!key) throw new Error("PANDADOC_API_KEY is not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `API-Key ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

async function pandadocFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: { ...headers(), ...init?.headers },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PandaDoc ${init?.method ?? "GET"} ${path}: ${response.status} ${text}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return undefined as T;
}

export interface PandaDocRecipient {
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  signing_order?: number;
}

export interface PandaDocField {
  name: string;
  value: string;
}

export interface PricingTableRow {
  options?: {
    optional?: boolean;
    optional_selected?: boolean;
    qty_editable?: boolean;
  };
  data: {
    Name: string;
    Description?: string;
    Price: number;
    QTY: number;
    Discount?: { value: number; type: "absolute" | "percent" };
    [key: string]: unknown;
  };
}

export interface PricingTableSection {
  title?: string;
  default: boolean;
  rows: PricingTableRow[];
}

export interface PricingTable {
  name: string;
  data_merge?: boolean;
  options?: {
    currency?: string;
    discount?: { type: string; name: string; value: number };
    Tax?: { name: string; type: string; value: number };
  };
  sections: PricingTableSection[];
}

export interface Token {
  name: string;
  value: string;
}

export interface CreateDocumentInput {
  templateId: string;
  name: string;
  recipients: PandaDocRecipient[];
  fields?: Record<string, { value: string }>;
  tokens?: Token[];
  pricingTables?: PricingTable[];
  metadata?: Record<string, string>;
  tags?: string[];
}

export interface PandaDocDocument {
  id: string;
  name: string;
  status: string;
  date_created: string;
  date_modified: string;
  uuid: string;
}

export async function createDocumentFromTemplate(
  input: CreateDocumentInput,
): Promise<PandaDocDocument> {
  return pandadocFetch<PandaDocDocument>("/documents", {
    method: "POST",
    body: JSON.stringify({
      template_uuid: input.templateId,
      name: input.name,
      recipients: input.recipients,
      ...(input.fields ? { fields: input.fields } : {}),
      ...(input.tokens ? { tokens: input.tokens } : {}),
      ...(input.pricingTables
        ? { pricing_tables: input.pricingTables }
        : {}),
      metadata: input.metadata,
      tags: input.tags,
    }),
  });
}

export interface DocumentDetails {
  id: string;
  name: string;
  status: string;
  grand_total: { amount: string; currency: string };
  pricing?: { tables?: { total: string }[] };
  [key: string]: unknown;
}

export async function getDocumentDetails(
  documentId: string,
): Promise<DocumentDetails> {
  return pandadocFetch<DocumentDetails>(`/documents/${documentId}/details`);
}

export async function getDocumentStatus(
  documentId: string,
): Promise<PandaDocDocument> {
  return pandadocFetch<PandaDocDocument>(`/documents/${documentId}`);
}

export async function waitForDocumentDraft(
  documentId: string,
  maxAttempts = 15,
  intervalMs = 2000,
): Promise<PandaDocDocument> {
  for (let i = 0; i < maxAttempts; i++) {
    const doc = await getDocumentStatus(documentId);
    if (doc.status === "document.draft") return doc;
    if (doc.status === "document.error") {
      throw new Error(`PandaDoc document ${documentId} entered error state`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `PandaDoc document ${documentId} did not reach draft status after ${maxAttempts} attempts`,
  );
}

export async function sendDocument(
  documentId: string,
  silent = true,
  subject?: string,
  message?: string,
): Promise<void> {
  await pandadocFetch(`/documents/${documentId}/send`, {
    method: "POST",
    body: JSON.stringify({
      silent,
      ...(subject ? { subject } : {}),
      ...(message ? { message } : {}),
    }),
  });
}

export interface EditingSession {
  id: string;
  email: string;
  expires_at: string;
  token: string;
  document_id: string;
}

export async function createDocumentEditingSession(
  documentId: string,
  editorEmail: string,
  lifetimeSeconds = 3600,
): Promise<EditingSession> {
  return pandadocFetch<EditingSession>(
    `/documents/${documentId}/editing-sessions`,
    {
      method: "POST",
      body: JSON.stringify({ email: editorEmail, lifetime: lifetimeSeconds }),
    },
  );
}

export interface SigningSession {
  id: string;
  expires_at: string;
}

export async function createSigningSession(
  documentId: string,
  recipientEmail: string,
): Promise<SigningSession> {
  return pandadocFetch<SigningSession>(`/documents/${documentId}/session`, {
    method: "POST",
    body: JSON.stringify({ recipient: recipientEmail }),
  });
}

export async function downloadDocumentPdf(
  documentId: string,
): Promise<ArrayBuffer> {
  const url = `${BASE_URL}/documents/${documentId}/download`;
  const response = await fetch(url, { headers: headers() });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PandaDoc download PDF: ${response.status} ${text}`);
  }

  return response.arrayBuffer();
}

export async function downloadSignedPdf(
  documentId: string,
): Promise<ArrayBuffer> {
  const url = `${BASE_URL}/documents/${documentId}/download-protected`;
  const response = await fetch(url, { headers: headers() });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PandaDoc download PDF: ${response.status} ${text}`);
  }

  return response.arrayBuffer();
}

export interface WebhookSubscription {
  uuid: string;
  name: string;
  url: string;
  active: boolean;
}

export async function createWebhookSubscription(
  name: string,
  url: string,
  triggers: string[],
): Promise<WebhookSubscription> {
  return pandadocFetch<WebhookSubscription>("/webhook-subscriptions", {
    method: "POST",
    body: JSON.stringify({
      name,
      url,
      triggers,
      active: true,
    }),
  });
}

export async function listWebhookSubscriptions(): Promise<
  WebhookSubscription[]
> {
  const result = await pandadocFetch<{ results: WebhookSubscription[] }>(
    "/webhook-subscriptions",
  );
  return result.results;
}
