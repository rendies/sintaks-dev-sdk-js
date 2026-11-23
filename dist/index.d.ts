/**
 * @sintaksdev/sdk — TypeScript client for the sintaks.dev OpenAI-compatible
 * AI API gateway. Zero runtime dependencies; requires Node >= 18 (global fetch).
 */
declare const DEFAULT_BASE_URL = "https://api.sintaks.dev";
declare const DEFAULT_CHAT_MODEL = "gpt-5-5";
declare const DEFAULT_IMAGE_MODEL = "gpt-5-5";
declare const DEFAULT_EMBEDDING_MODEL = "qwen3-embedding-0-6b";
type MessageContentPart = {
    type: "text";
    text: string;
};
interface ChatMessage {
    role: "system" | "developer" | "user" | "assistant" | "tool";
    content: string | MessageContentPart[];
    name?: string;
}
interface ChatCompletionCreateParams {
    model?: string;
    messages: ChatMessage[];
    stream?: boolean;
    stream_options?: {
        include_usage?: boolean;
    };
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    max_completion_tokens?: number;
    stop?: string | string[];
    [key: string]: unknown;
}
interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
interface ChatCompletion {
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
interface ChatCompletionChunk {
    id: string;
    object: "chat.completion.chunk";
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: string;
            content?: string | null;
        };
        finish_reason: string | null;
    }[];
    usage?: Usage;
}
interface Model {
    id: string;
    object: "model";
    created: number;
    owned_by: string;
}
interface ModelList {
    object: "list";
    data: Model[];
}
interface ImageGenerationParams {
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
type ImageFileInput = Blob | Uint8Array | ArrayBuffer | string;
interface ImageEditParams {
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
interface GeneratedImage {
    url?: string;
    b64_json?: string;
}
interface ImageGenerationResult {
    created: number;
    data: GeneratedImage[];
}
interface VideoCreateParams {
    model?: string;
    prompt: string;
    seconds?: number;
    /** Passed through: resolution/size, aspect ratio, audio. */
    size?: string;
    aspect_ratio?: string;
    audio?: boolean;
    [key: string]: unknown;
}
interface VideoObject {
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
interface EmbeddingCreateParams {
    model?: string;
    input: string | string[];
    encoding_format?: "float";
    dimensions?: number;
    [key: string]: unknown;
}
interface EmbeddingObject {
    object: "embedding";
    index: number;
    embedding: number[];
}
interface EmbeddingResponse {
    object: "list";
    data: EmbeddingObject[];
    model: string;
    usage?: {
        prompt_tokens: number;
        total_tokens: number;
    };
}
interface ResponsesCreateParams {
    model?: string;
    input: string;
    instructions?: string;
    max_output_tokens?: number;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
    [key: string]: unknown;
}
interface ResponsesObject {
    id: string;
    object: "response";
    status: string;
    model: string;
    output?: unknown[];
    usage?: unknown;
}
interface ErrorEnvelope {
    error?: {
        message?: string;
        type?: string;
        param?: string | null;
        code?: string | null;
    };
}
declare class SintaksError extends Error {
    readonly status: number;
    readonly type: string | undefined;
    readonly code: string | null;
    readonly requestId: string | null;
    constructor(status: number, message: string, opts?: {
        type?: string;
        code?: string | null;
        requestId?: string | null;
    });
    /** True for missing, malformed, revoked, or invalid API keys (401). */
    get isUnauthorized(): boolean;
    /** True when the account balance can't cover the request (402). Top up first. */
    get isInsufficientCredits(): boolean;
    /** True for upstream throttling (429). */
    get isRateLimited(): boolean;
    /** True for errors worth retrying with backoff: 429, 503, 504. */
    get isRetryable(): boolean;
}
interface SintaksOptions {
    apiKey: string;
    baseURL?: string;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
declare class Sintaks {
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
    constructor(options: SintaksOptions);
    request<T>(method: string, path: string, body?: unknown): Promise<T>;
}
declare class ChatResource {
    private client;
    readonly completions: this;
    constructor(client: Sintaks);
    create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
    create(params: ChatCompletionCreateParams & {
        stream: true;
    }): Promise<AsyncIterable<ChatCompletionChunk>>;
    private createStream;
}
declare class ImagesResource {
    private client;
    constructor(client: Sintaks);
    generate(params: ImageGenerationParams): Promise<ImageGenerationResult>;
    /** Image-to-image edits / inpainting (POST /v1/images/edits, multipart). */
    edits(params: ImageEditParams): Promise<ImageGenerationResult>;
}
declare class ModelsResource {
    private client;
    constructor(client: Sintaks);
    /** Lists the active models served by the gateway (GET /v1/models). */
    list(): Promise<ModelList>;
}
declare class EmbeddingsResource {
    private client;
    constructor(client: Sintaks);
    create(params: EmbeddingCreateParams): Promise<EmbeddingResponse>;
}
declare class ResponsesResource {
    private client;
    constructor(client: Sintaks);
    create(params: ResponsesCreateParams): Promise<ResponsesObject>;
}
declare class VideosResource {
    private client;
    constructor(client: Sintaks);
    /** Submit an async video generation job (POST /v1/videos). No default
     *  model: video models are per-provider, so `model` is required. */
    create(params: VideoCreateParams): Promise<VideoObject>;
    /** Poll the job status (GET /v1/videos/{id}). */
    retrieve(id: string): Promise<VideoObject>;
}

export { type ChatCompletion, type ChatCompletionChunk, type ChatCompletionCreateParams, type ChatMessage, DEFAULT_BASE_URL, DEFAULT_CHAT_MODEL, DEFAULT_EMBEDDING_MODEL, DEFAULT_IMAGE_MODEL, type EmbeddingCreateParams, type EmbeddingObject, type EmbeddingResponse, type ErrorEnvelope, type GeneratedImage, type ImageEditParams, type ImageFileInput, type ImageGenerationParams, type ImageGenerationResult, type MessageContentPart, type Model, type ModelList, type ResponsesCreateParams, type ResponsesObject, Sintaks, SintaksError, type SintaksOptions, type Usage, type VideoCreateParams, type VideoObject, Sintaks as default };
