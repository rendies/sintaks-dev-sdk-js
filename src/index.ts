/**
 * @sintaksdev/sdk — TypeScript client for the sintaks.dev OpenAI-compatible
 * AI API gateway. Zero runtime dependencies; requires Node >= 18 (global fetch).
 */

export const DEFAULT_BASE_URL = "https://api.sintaks.dev";
export const DEFAULT_CHAT_MODEL = "gpt-5-5";
export const DEFAULT_IMAGE_MODEL = "gpt-5-5";
export const DEFAULT_EMBEDDING_MODEL = "qwen3-embedding-0-6b";

/* ------------------------------------------------------------------ */
/* Types (OpenAI-compatible shapes)                                    */
/* ------------------------------------------------------------------ */

export type MessageContentPart = { type: "text"; text: string };

export interface ChatMessage {
  role: "system" | "developer" | "user" | "assistant" | "tool";
  content: string | MessageContentPart[];
  name?: string;
}

export interface ChatCompletionCreateParams {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stop?: string | string[];
  [key: string]: unknown;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
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
  usage?: Usage;
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
  usage?: Usage;
}

export interface Model {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export interface ModelList {
  object: "list";
  data: Model[];
}

export interface ImageGenerationParams {
  model?: string;
  prompt: string;
  n?: number;
  size?: string;
  [key: string]: unknown;
}

/**
 * Accepts a Blob/File (multipart part), raw bytes, or a string (blob text).
 * For local files pass a `File`; in Node pass a `Buffer` (a `Uint8Array`).
 */
export type ImageFileInput = Blob | Uint8Array | ArrayBuffer | string;

export interface ImageEditParams {
  model?: string;
  prompt: string;
  /** One or more source images (multipart `image` parts). */
  image: ImageFileInput | ImageFileInput[];
  /** Optional mask(s) for inpainting (multipart `mask` parts). */
  mask?: ImageFileInput | ImageFileInput[];
  n?: number;
  size?: string;
  response_format?: "url" | "b64_json";
  /** Passed through when the model supports them: quality, style, background, … */
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

export interface VideoCreateParams {
  model?: string;
  prompt: string;
  seconds?: number;
  /** Passed through: resolution/size, aspect ratio, audio. */
  size?: string;
  aspect_ratio?: string;
  audio?: boolean;
  [key: string]: unknown;
}

export interface VideoObject {
  id: string;
  object: "video";
  created_at: number;
  status: "queued" | "in_progress" | "completed" | "failed";
  model?: string;
  seconds?: number;
  url?: string;
  error?: string | null;
  completed_at?: number | null;
  usage?: Usage | null;
}

export interface EmbeddingCreateParams {
  model?: string;
  input: string | string[];
  encoding_format?: "float";
  dimensions?: number;
  [key: string]: unknown;
}

export interface EmbeddingObject {
  object: "embedding";
  index: number;
  embedding: number[];
}

export interface EmbeddingResponse {
  object: "list";
  data: EmbeddingObject[];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface ResponsesCreateParams {
  model?: string;
  input: string;
  instructions?: string;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface ResponsesObject {
  id: string;
  object: "response";
  status: string;
  model: string;
  output?: unknown[];
  usage?: unknown;
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

  /** True for missing, malformed, revoked, or invalid API keys (401). */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True when the account balance can't cover the request (402). Top up first. */
  get isInsufficientCredits(): boolean {
    return this.status === 402;
  }

  /** True for upstream throttling (429). */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** True for errors worth retrying with backoff: 429, 503, 504. */
  get isRetryable(): boolean {
    return this.status === 429 || this.status === 503 || this.status === 504;
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
  readonly embeddings: EmbeddingsResource;
  readonly responses: ResponsesResource;
  readonly videos: VideosResource;
  readonly models: ModelsResource;

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
    this.embeddings = new EmbeddingsResource(this);
    this.responses = new ResponsesResource(this);
    this.videos = new VideosResource(this);
    this.models = new ModelsResource(this);
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
      body: JSON.stringify({
        ...params,
        model: params.model ?? DEFAULT_CHAT_MODEL,
        stream_options: { include_usage: true },
      }),
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
    return this.client.request<ImageGenerationResult>("POST", "/v1/images/generations", {
      ...params,
      model: params.model ?? DEFAULT_IMAGE_MODEL,
    });
  }

  /** Image-to-image edits / inpainting (POST /v1/images/edits, multipart). */
  async edits(params: ImageEditParams): Promise<ImageGenerationResult> {
    const form = new FormData();

    const appendParts = (name: string, value: ImageFileInput | ImageFileInput[]) => {
      const parts = Array.isArray(value) ? value : [value];
      for (const part of parts) {
        form.append(name, toBlob(part));
      }
    };

    appendParts("image", params.image);
    if (params.mask !== undefined) appendParts("mask", params.mask);
    form.append("prompt", params.prompt);
    form.append("model", params.model ?? DEFAULT_IMAGE_MODEL);
    if (params.n !== undefined) form.append("n", String(params.n));
    if (params.size !== undefined) form.append("size", params.size);
    if (params.response_format !== undefined) form.append("response_format", params.response_format);

    const passthrough = new Set(["image", "mask", "prompt", "model", "n", "size", "response_format"]);
    for (const [key, value] of Object.entries(params)) {
      if (passthrough.has(key) || typeof value !== "string") continue;
      form.append(key, value);
    }

    const res = await this.client.fetchFn(`${this.client.baseURL}/v1/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.client.apiKey}`,
        ...this.client.extraHeaders,
      },
      body: form,
    });

    if (!res.ok) {
      let envelope: ErrorEnvelope = {};
      try {
        envelope = (await res.json()) as ErrorEnvelope;
      } catch {
        // ignore non-JSON error body
      }
      throw new SintaksError(res.status, envelope.error?.message ?? `request failed with ${res.status}`, {
        type: envelope.error?.type,
        code: envelope.error?.code,
        requestId: res.headers.get("x-request-id"),
      });
    }
    return (await res.json()) as ImageGenerationResult;
  }
}

function toBlob(input: ImageFileInput): Blob {
  if (input instanceof Blob) return input;
  if (input instanceof Uint8Array) {
    // Copy into an ArrayBuffer-backed view so it always satisfies BlobPart.
    const copy = new Uint8Array(input.byteLength);
    copy.set(input);
    return new Blob([copy.buffer]);
  }
  if (input instanceof ArrayBuffer) return new Blob([input]);
  return new Blob([input]);
}

class ModelsResource {
  constructor(private client: Sintaks) {}

  /** Lists the active models served by the gateway (GET /v1/models). */
  async list(): Promise<ModelList> {
    return this.client.request<ModelList>("GET", "/v1/models");
  }
}

/* ------------------------------------------------------------------ */
/* Embeddings                                                          */
/* ------------------------------------------------------------------ */

class EmbeddingsResource {
  constructor(private client: Sintaks) {}

  async create(params: EmbeddingCreateParams): Promise<EmbeddingResponse> {
    return this.client.request<EmbeddingResponse>("POST", "/v1/embeddings", {
      ...params,
      model: params.model ?? DEFAULT_EMBEDDING_MODEL,
    });
  }
}

class ResponsesResource {
  constructor(private client: Sintaks) {}

  async create(params: ResponsesCreateParams): Promise<ResponsesObject> {
    return this.client.request<ResponsesObject>("POST", "/v1/responses", {
      ...params,
      model: params.model ?? DEFAULT_CHAT_MODEL,
    });
  }
}

class VideosResource {
  constructor(private client: Sintaks) {}

  /** Submit an async video generation job (POST /v1/videos). No default
   *  model: video models are per-provider, so `model` is required. */
  async create(params: VideoCreateParams): Promise<VideoObject> {
    return this.client.request<VideoObject>("POST", "/v1/videos", params);
  }

  /** Poll the job status (GET /v1/videos/{id}). */
  async retrieve(id: string): Promise<VideoObject> {
    return this.client.request<VideoObject>("GET", `/v1/videos/${encodeURIComponent(id)}`);
  }
}

export default Sintaks;