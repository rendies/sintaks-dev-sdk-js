/**
 * @sintaksdev/sdk — TypeScript client for the sintaks.dev OpenAI-compatible
 * AI API gateway. Zero runtime dependencies; requires Node >= 18 (global fetch).
 */

export const DEFAULT_BASE_URL = "https://api.sintaks.dev";
export const DEFAULT_CHAT_MODEL = "claude-sonnet-5-5";

/* ------------------------------------------------------------------ */
/* Types (OpenAI-compatible shapes)                                    */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface ChatCompletionCreateParams {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  [key: string]: unknown;
}

export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    delta: { role?: string; content?: string | null };
    finish_reason: string | null;
  }[];
}

export interface ImageGenerationParams {
  model?: string;
  prompt: string;
  n?: number;
  size?: string;
  [key: string]: unknown;
}

export interface GeneratedImage {
  url?: string;
  b64_json?: string;
}

export interface ImageGenerationResult {
  created: number;
  data: GeneratedImage[];
}

export interface ErrorEnvelope {
  error?: {
    message?: string;
    type?: string;
    param?: string | null;
    code?: string | null;
  };
}

/* ------------------------------------------------------------------ */
/* Error                                                               */
/* ------------------------------------------------------------------ */

export class SintaksError extends Error {
  readonly status: number;
  readonly type: string | undefined;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(
    status: number,
    message: string,
    opts: { type?: string; code?: string | null; requestId?: string | null } = {},
  ) {
    super(message);
    this.name = "SintaksError";
    this.status = status;
    this.type = opts.type;
    this.code = opts.code ?? null;
    this.requestId = opts.requestId ?? null;
  }
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export interface SintaksOptions {
  apiKey: string;
  baseURL?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export class Sintaks {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly chat: ChatResource;
  readonly images: ImagesResource;

  /** @internal */
  readonly fetchFn: typeof fetch;
  /** @internal */
  readonly extraHeaders: Record<string, string>;

  constructor(options: SintaksOptions) {
    if (!options.apiKey) throw new Error("Sintaks: apiKey is required");
    this.apiKey = options.apiKey;
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchFn = options.fetch ?? fetch;
    this.extraHeaders = options.headers ?? {};
    this.chat = new ChatResource(this);
    this.images = new ImagesResource(this);
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchFn(`${this.baseURL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      let envelope: ErrorEnvelope = {};
      try {
        envelope = (await res.json()) as ErrorEnvelope;
      } catch {
        // non-JSON error body; fall through with defaults
      }
      throw new SintaksError(res.status, envelope.error?.message ?? `request failed with ${res.status}`, {
        type: envelope.error?.type,
        code: envelope.error?.code,
        requestId: res.headers.get("x-request-id"),
      });
    }
    return (await res.json()) as T;
  }
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

class ChatResource {
  readonly completions = this;

  constructor(private client: Sintaks) {}

  async create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
  async create(params: ChatCompletionCreateParams & { stream: true }): Promise<AsyncIterable<ChatCompletionChunk>>;
  async create(
    params: ChatCompletionCreateParams,
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> {
    if (params.stream) {
      return this.createStream(params as ChatCompletionCreateParams & { stream: true });
    }
    return this.client.request<ChatCompletion>("POST", "/v1/chat/completions", {
      ...params,
      model: params.model ?? DEFAULT_CHAT_MODEL,
    });
  }

  private async createStream(
    params: ChatCompletionCreateParams & { stream: true },
  ): Promise<AsyncIterable<ChatCompletionChunk>> {
    const res = await this.client.fetchFn(`${this.client.baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.client.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...this.client.extraHeaders,
      },
      body: JSON.stringify({ ...params, model: params.model ?? DEFAULT_CHAT_MODEL }),
    });

    if (!res.ok || !res.body) {
      let envelope: ErrorEnvelope = {};
      try {
        envelope = (await res.json()) as ErrorEnvelope;
      } catch {
        // ignore
      }
      throw new SintaksError(res.status, envelope.error?.message ?? `request failed with ${res.status}`, {
        type: envelope.error?.type,
        code: envelope.error?.code,
        requestId: res.headers.get("x-request-id"),
      });
    }

    return parseSSE<ChatCompletionChunk>(res.body);
  }
}

/** Minimal SSE parser for OpenAI-style `data:` events. */
async function* parseSSE<T>(body: ReadableStream<Uint8Array>): AsyncIterable<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = chunk
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          yield JSON.parse(payload) as T;
        } catch {
          // skip malformed event
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

class ImagesResource {
  constructor(private client: Sintaks) {}

  async generate(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    return this.client.request<ImageGenerationResult>("POST", "/v1/images/generations", params);
  }
}

export default Sintaks;