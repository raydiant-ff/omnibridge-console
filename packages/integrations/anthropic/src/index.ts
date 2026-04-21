export class AnthropicApiError extends Error {
  statusCode: number;
  requestId: string | null;

  constructor(message: string, statusCode: number, requestId: string | null = null) {
    super(message);
    this.name = "AnthropicApiError";
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicGenerateTextOptions {
  systemPrompt: string;
  messages: AnthropicMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AnthropicGenerateTextResult {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
}

export type AnthropicModelPreset = "sonnet" | "opus";

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: AnthropicTextBlock[];
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

function getAnthropicConfigFromEnv() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY must be set");
  }

  return {
    apiKey,
    baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com/v1/messages",
    defaultModel: process.env.ANTHROPIC_MODEL_DEFAULT?.trim() || "claude-sonnet-4-6",
    complexModel: process.env.ANTHROPIC_MODEL_COMPLEX?.trim() || "claude-opus-4-6",
  };
}

export function resolveAnthropicModel(preset?: AnthropicModelPreset) {
  const config = getAnthropicConfigFromEnv();

  if (preset === "opus") {
    return config.complexModel;
  }

  return config.defaultModel;
}

export async function generateAnthropicText(
  options: AnthropicGenerateTextOptions,
): Promise<AnthropicGenerateTextResult> {
  const config = getAnthropicConfigFromEnv();
  const payload = {
    model: options.model || config.defaultModel,
    max_tokens: options.maxTokens ?? 900,
    temperature: options.temperature ?? 0.3,
    system: options.systemPrompt,
    messages: options.messages,
    stream: false,
  };

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AnthropicApiError(
      `Anthropic API error: ${response.status} ${text}`,
      response.status,
      response.headers.get("request-id"),
    );
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = data.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return {
    text,
    model: data.model,
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
    stopReason: data.stop_reason ?? null,
  };
}
