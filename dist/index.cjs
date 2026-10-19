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
  DEFAULT_IMAGE_MODEL: () => DEFAULT_IMAGE_MODEL,
  Sintaks: () => Sintaks,
  SintaksError: () => SintaksError,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var DEFAULT_BASE_URL = "https://api.sintaks.dev";
var DEFAULT_CHAT_MODEL = "claude-sonnet-5-5";
var DEFAULT_IMAGE_MODEL = "stable-image-core";
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
};
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
var index_default = Sintaks;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  Sintaks,
  SintaksError
});
//# sourceMappingURL=index.cjs.map