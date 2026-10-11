/**
 * @sintaksdev/sdk — TypeScript client for the sintaks.dev OpenAI-compatible
 * AI API gateway. Zero runtime dependencies; requires Node >= 18 (global fetch).
 */
declare const DEFAULT_BASE_URL = "https://api.sintaks.dev";
declare const DEFAULT_CHAT_MODEL = "claude-sonnet-5-5";
interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
}
interface ChatCompletionCreateParams {
    model?: string;
    messages: ChatMessage[];
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stop?: string | string[];
    [key: string]: unknown;
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
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
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
}
interface ImageGenerationParams {
    model?: string;
    prompt: string;
    n?: number;
    size?: string;
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
}

export { type ChatCompletion, type ChatCompletionChunk, type ChatCompletionCreateParams, type ChatMessage, DEFAULT_BASE_URL, DEFAULT_CHAT_MODEL, type ErrorEnvelope, type GeneratedImage, type ImageGenerationParams, type ImageGenerationResult, Sintaks, SintaksError, type SintaksOptions, Sintaks as default };
