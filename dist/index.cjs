"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  DEFAULT_BASE_URL: () => DEFAULT_BASE_URL,
  DEFAULT_CHAT_MODEL: () => DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_MODEL: () => DEFAULT_EMBEDDING_MODEL,
  DEFAULT_IMAGE_MODEL: () => DEFAULT_IMAGE_MODEL,
  Sintaks: () => Sintaks,
  SintaksError: () => SintaksError,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var DEFAULT_BASE_URL = "https://api.sintaks.dev";
var DEFAULT_CHAT_MODEL = "gpt-5-5";
var DEFAULT_IMAGE_MODEL = "gpt-5-5";
var DEFAULT_EMBEDDING_MODEL = "qwen3-embedding-0-6b";
var SintaksError = class extends Error {
  status;
  type;
  code;
  requestId;
  constructor(status, message, opts = {}) {
    super(message);
    this.name = "SintaksError";
    this.status = status;
    this.type = opts.type;
    this.code = opts.code ?? null;
    this.requestId = opts.requestId ?? null;
  }
  /** True for missing, malformed, revoked, or invalid API keys (401). */
  get isUnauthorized() {
    return this.status === 401;
  }
  /** True when the account balance can't cover the request (402). Top up first. */
  get isInsufficientCredits() {
    return this.status === 402;
  }
  /** True for upstream throttling (429). */
  get isRateLimited() {
    return this.status === 429;
  }
  /** True for errors worth retrying with backoff: 429, 503, 504. */
  get isRetryable() {
    return this.status === 429 || this.status === 503 || this.status === 504;
  }
};
var Sintaks = class {
  apiKey;
  baseURL;
  chat;
  images;
  embeddings;
  responses;
  videos;
  models;
  /** @internal */
  fetchFn;
  /** @internal */
  extraHeaders;
  constructor(options) {
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
  async request(method, path, body) {
    const res = await this.fetchFn(`${this.baseURL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.extraHeaders
      },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    if (!res.ok) {
      let envelope = {};
      try {
        envelope = await res.json();
      } catch {
      }
      throw new SintaksError(res.status, envelope.error?.message ?? `request failed with ${res.status}`, {
        type: envelope.error?.type,
        code: envelope.error?.code,
        requestId: res.headers.get("x-request-id")
      });
    }
    return await res.json();
  }
};
var ChatResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  completions = this;
  async create(params) {
    if (params.stream) {
      return this.createStream(params);
    }
    return this.client.request("POST", "/v1/chat/completions", {
      ...params,
      model: params.model ?? DEFAULT_CHAT_MODEL
    });
  }
  async createStream(params) {
    const res = await this.client.fetchFn(`${this.client.baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.client.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...this.client.extraHeaders
      },
      body: JSON.stringify({
        ...params,
        model: params.model ?? DEFAULT_CHAT_MODEL,
        stream_options: { include_usage: true }
      })
    });
    if (!res.ok || !res.body) {
      let envelope = {};
      try {
        envelope = await res.json();
      } catch {
      }
      throw new SintaksError(res.status, envelope.error?.message ?? `request failed with ${res.status}`, {
        type: envelope.error?.type,
        code: envelope.error?.code,
        requestId: res.headers.get("x-request-id")
      });
    }
    return parseSSE(res.body);
  }
};
async function* parseSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          yield JSON.parse(payload);
        } catch {
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
var ImagesResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async generate(params) {
    return this.client.request("POST", "/v1/images/generations", {
      ...params,
      model: params.model ?? DEFAULT_IMAGE_MODEL
    });
  }
  /** Image-to-image edits / inpainting (POST /v1/images/edits, multipart). */
  async edits(params) {
    const form = new FormData();
    const appendParts = (name, value) => {
      const parts = Array.isArray(value) ? value : [value];
      for (const part of parts) {
        form.append(name, toBlob(part));
      }
    };
    appendParts("image", params.image);
    if (params.mask !== void 0) appendParts("mask", params.mask);
    form.append("prompt", params.prompt);
    form.append("model", params.model ?? DEFAULT_IMAGE_MODEL);
    if (params.n !== void 0) form.append("n", String(params.n));
    if (params.size !== void 0) form.append("size", params.size);
    if (params.response_format !== void 0) form.append("response_format", params.response_format);
    const passthrough = /* @__PURE__ */ new Set(["image", "mask", "prompt", "model", "n", "size", "response_format"]);
    for (const [key, value] of Object.entries(params)) {
      if (passthrough.has(key) || typeof value !== "string") continue;
      form.append(key, value);
    }
    const res = await this.client.fetchFn(`${this.client.baseURL}/v1/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.client.apiKey}`,
        ...this.client.extraHeaders
      },
      body: form
    });
    if (!res.ok) {
      let envelope = {};
      try {
        envelope = await res.json();
      } catch {
      }
      throw new SintaksError(res.status, envelope.error?.message ?? `request failed with ${res.status}`, {
        type: envelope.error?.type,
        code: envelope.error?.code,
        requestId: res.headers.get("x-request-id")
      });
    }
    return await res.json();
  }
};
function toBlob(input) {
  if (input instanceof Blob) return input;
  if (input instanceof Uint8Array) {
    const copy = new Uint8Array(input.byteLength);
    copy.set(input);
    return new Blob([copy.buffer]);
  }
  if (input instanceof ArrayBuffer) return new Blob([input]);
  return new Blob([input]);
}
var ModelsResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  /** Lists the active models served by the gateway (GET /v1/models). */
  async list() {
    return this.client.request("GET", "/v1/models");
  }
};
var EmbeddingsResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async create(params) {
    return this.client.request("POST", "/v1/embeddings", {
      ...params,
      model: params.model ?? DEFAULT_EMBEDDING_MODEL
    });
  }
};
var ResponsesResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  async create(params) {
    return this.client.request("POST", "/v1/responses", {
      ...params,
      model: params.model ?? DEFAULT_CHAT_MODEL
    });
  }
};
var VideosResource = class {
  constructor(client) {
    this.client = client;
  }
  client;
  /** Submit an async video generation job (POST /v1/videos). No default
   *  model: video models are per-provider, so `model` is required. */
  async create(params) {
    return this.client.request("POST", "/v1/videos", params);
  }
  /** Poll the job status (GET /v1/videos/{id}). */
  async retrieve(id) {
    return this.client.request("GET", `/v1/videos/${encodeURIComponent(id)}`);
  }
};
var index_default = Sintaks;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_IMAGE_MODEL,
  Sintaks,
  SintaksError
});
//# sourceMappingURL=index.cjs.map