import jwt from "jsonwebtoken";

export class DocuSignApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "DocuSignApiError";
    this.statusCode = statusCode;
  }
}

type DocuSignToken = { accessToken: string; expiresAt: number };

let tokenPromise: Promise<DocuSignToken> | null = null;

function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} is not set`);
  return val;
}

async function fetchNewToken(): Promise<DocuSignToken> {
  const now = Date.now();

  const integrationKey = getEnvOrThrow("DOCUSIGN_INTEGRATION_KEY");
  const userId = getEnvOrThrow("DOCUSIGN_USER_ID");
  const authServer = getEnvOrThrow("DOCUSIGN_AUTH_SERVER");
  const privateKeyB64 = getEnvOrThrow("DOCUSIGN_RSA_PRIVATE_KEY");

  const rsaKey = Buffer.from(privateKeyB64, "base64").toString("utf-8");

  const assertion = jwt.sign(
    {
      iss: integrationKey,
      sub: userId,
      aud: authServer,
      scope: "signature impersonation",
    },
    rsaKey,
    { algorithm: "RS256", expiresIn: 600, header: { alg: "RS256", typ: "JWT" } },
  );

  const resp = await fetch(`https://${authServer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new DocuSignApiError(`DocuSign JWT auth failed (${resp.status}): ${text}`, resp.status);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
}

async function getAccessToken(): Promise<string> {
  if (tokenPromise) {
    const cached = await tokenPromise;
    if (Date.now() < cached.expiresAt - 60_000) {
      return cached.accessToken;
    }
  }

  tokenPromise = fetchNewToken();
  try {
    const token = await tokenPromise;
    return token.accessToken;
  } catch (err) {
    tokenPromise = null;
    throw err;
  }
}

async function getBaseUri(): Promise<string> {
  const accountId = getEnvOrThrow("DOCUSIGN_ACCOUNT_ID");
  const token = await getAccessToken();
  const authServer = getEnvOrThrow("DOCUSIGN_AUTH_SERVER");

  const resp = await fetch(`https://${authServer}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new DocuSignApiError(`DocuSign userinfo failed (${resp.status}): ${text}`, resp.status);
  }

  const info = (await resp.json()) as {
    accounts: Array<{ account_id: string; base_uri: string }>;
  };

  const account =
    info.accounts.find((a) => a.account_id === accountId) ?? info.accounts[0];

  return `${account.base_uri}/restapi/v2.1/accounts/${accountId}`;
}

let cachedBaseUri: string | null = null;

async function apiCall(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  if (!cachedBaseUri) {
    cachedBaseUri = await getBaseUri();
  }

  const resp = await fetch(`${cachedBaseUri}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  return resp;
}

export interface CreateEnvelopeInput {
  pdfBuffer: Buffer;
  signerEmail: string;
  signerName: string;
  emailSubject: string;
  documentName?: string;
  webhookUrl?: string;
  customFields?: Record<string, string>;
}

export async function createEnvelope(
  input: CreateEnvelopeInput,
): Promise<string> {
  const body: Record<string, unknown> = {
    emailSubject: input.emailSubject,
    documents: [
      {
        documentBase64: input.pdfBuffer.toString("base64"),
        name: input.documentName ?? "Quote.pdf",
        fileExtension: "pdf",
        documentId: "1",
      },
    ],
    recipients: {
      signers: [
        {
          email: input.signerEmail,
          name: input.signerName,
          recipientId: "1",
          routingOrder: "1",
          clientUserId: "1001",
          tabs: {
            signHereTabs: [
              {
                anchorString: "/sn1/",
                anchorUnits: "pixels",
                anchorXOffset: "0",
                anchorYOffset: "-10",
                scaleValue: "1",
              },
            ],
            dateSignedTabs: [
              {
                anchorString: "/ds1/",
                anchorUnits: "pixels",
                anchorXOffset: "0",
                anchorYOffset: "0",
                fontSize: "Size10",
              },
            ],
            fullNameTabs: [
              {
                anchorString: "/fn1/",
                anchorUnits: "pixels",
                anchorXOffset: "0",
                anchorYOffset: "0",
                fontSize: "Size10",
              },
            ],
          },
        },
      ],
    },
    status: "sent",
  };

  if (input.webhookUrl) {
    body.eventNotification = {
      url: input.webhookUrl,
      requireAcknowledgment: "true",
      loggingEnabled: "true",
      eventData: { version: "restv2.1", format: "json" },
      envelopeEvents: [
        { envelopeEventStatusCode: "completed" },
        { envelopeEventStatusCode: "declined" },
        { envelopeEventStatusCode: "voided" },
      ],
    };
  }

  if (input.customFields) {
    body.customFields = {
      textCustomFields: Object.entries(input.customFields).map(
        ([name, value]) => ({ name, value, show: "false" }),
      ),
    };
  }

  const resp = await apiCall("/envelopes", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new DocuSignApiError(`DocuSign createEnvelope failed (${resp.status}): ${text}`, resp.status);
  }

  const result = (await resp.json()) as { envelopeId?: string };

  if (!result.envelopeId) {
    throw new Error("DocuSign createEnvelope did not return an envelopeId");
  }

  return result.envelopeId;
}

export interface CreateRecipientViewInput {
  envelopeId: string;
  signerEmail: string;
  signerName: string;
  returnUrl: string;
}

export async function createRecipientView(
  input: CreateRecipientViewInput,
): Promise<string> {
  const appUrl =
    process.env.DOCUSIGN_APP_URL ?? "https://apps-d.docusign.com";
  const siteUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const resp = await apiCall(
    `/envelopes/${input.envelopeId}/views/recipient`,
    {
      method: "POST",
      body: JSON.stringify({
        returnUrl: input.returnUrl,
        authenticationMethod: "email",
        email: input.signerEmail,
        userName: input.signerName,
        recipientId: "1",
        clientUserId: "1001",
        frameAncestors: [siteUrl, appUrl],
        messageOrigins: [appUrl],
      }),
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new DocuSignApiError(
      `DocuSign createRecipientView failed (${resp.status}): ${text}`,
      resp.status,
    );
  }

  const result = (await resp.json()) as { url?: string };

  if (!result.url) {
    throw new Error("DocuSign createRecipientView did not return a URL");
  }

  return result.url;
}

export async function getEnvelopeStatus(envelopeId: string): Promise<string> {
  const resp = await apiCall(`/envelopes/${envelopeId}`);

  if (!resp.ok) {
    const text = await resp.text();
    throw new DocuSignApiError(
      `DocuSign getEnvelope failed (${resp.status}): ${text}`,
      resp.status,
    );
  }

  const envelope = (await resp.json()) as { status?: string };
  return envelope.status ?? "unknown";
}

export async function downloadSignedDocument(
  envelopeId: string,
): Promise<Buffer> {
  const token = await getAccessToken();
  if (!cachedBaseUri) {
    cachedBaseUri = await getBaseUri();
  }

  const resp = await fetch(
    `${cachedBaseUri}/envelopes/${envelopeId}/documents/combined`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new DocuSignApiError(
      `DocuSign downloadDocument failed (${resp.status}): ${text}`,
      resp.status,
    );
  }

  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export function getIntegrationKey(): string {
  return getEnvOrThrow("DOCUSIGN_INTEGRATION_KEY");
}

export function getDocuSignJsBundleUrl(): string {
  const authServer = process.env.DOCUSIGN_AUTH_SERVER ?? "";
  if (authServer.includes("account-d")) {
    return "https://js-d.docusign.com/bundle.js";
  }
  return "https://js.docusign.com/bundle.js";
}
