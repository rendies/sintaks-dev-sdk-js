# @sintaksdev/sdk

TypeScript client for the [sintaks.dev](https://sintaks.dev) OpenAI-compatible AI API gateway. Top up in IDR via QRIS/iPaymu, call chat and image models, and pay per request. Zero runtime dependencies (Node >= 18, global `fetch`).

## Install

```bash
pnpm add @sintaksdev/sdk
# or
npm install @sintaksdev/sdk
```

## Usage

```ts
import { Sintaks } from "@sintaksdev/sdk";

const client = new Sintaks({ apiKey: "sk-..." });

// Non-streaming chat
const resp = await client.chat.completions.create({
  model: "claude-sonnet-5-5",
  messages: [{ role: "user", content: "Halo!" }],
});
console.log(resp.choices[0]?.message.content);

// Streaming
const stream = await client.chat.completions.create({
  model: "claude-sonnet-5-5",
  messages: [{ role: "user", content: "Halo!" }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}

// Image generation
const images = await client.images.generate({
  prompt: "A futuristic Jakarta skyline at dusk",
});
console.log(images.data[0]?.url);

// Image edit (img2img / inpainting, multipart)
import { readFile } from "node:fs/promises";
const edited = await client.images.edits({
  prompt: "Add a chocolate fountain on the right",
  image: await readFile("input.png"), // File | Blob | Uint8Array | ArrayBuffer | string
  mask: await readFile("mask.png"),   // optional, for inpainting
  model: "gpt-image-1",
  size: "1024x1024",
});
console.log(edited.data[0]?.url);

// Embeddings (default model qwen3-embedding-0-6b, 1024 dimensions)
// Async video generation: submit, poll, then use the CDN URL.
const job = await client.videos.create({
  model: "google/veo-3.1-lite-generate-001",
  prompt: "a cat on a beach",
  seconds: 4,
});
let video = job;
while (video.status === "queued" || video.status === "in_progress") {
  await new Promise((r) => setTimeout(r, 5000));
  video = await client.videos.retrieve(job.id);
}
console.log(video.url); // provider CDN URL

const embedding = await client.embeddings.create({
  input: ["Serverless Postgres with sintaks.dev"],
});
console.log(embedding.data[0].embedding.length); // 1024

// List active models
const models = await client.models.list();
console.log(models.data.map((m) => m.id));
```

`model` defaults to `gpt-5-5` for chat and images, and
`qwen3-embedding-0-6b` for embeddings when omitted. `dimensions`
and `encoding_format: "float"` are supported on embeddings. Streaming requests
ask for `stream_options.include_usage`, so the final chunk carries `usage`.
Point at another environment with `baseURL`:

```ts
const client = new Sintaks({ apiKey: "sk-...", baseURL: "http://localhost:8080" });
```

## Errors

Failures throw `SintaksError` with `status`, `type`, `code`, and `requestId` (the gateway `X-Request-ID`, useful for support). Convenience getters map the gateway's status semantics:

```ts
try {
  await client.chat.completions.create({ messages: [{ role: "user", content: "x" }] });
} catch (err) {
  if (err instanceof SintaksError) {
    if (err.isUnauthorized) console.error("invalid or revoked api key");
    if (err.isInsufficientCredits) console.error("insufficient balance, top up first");
    if (err.isRetryable) console.error(`retry after ${err.requestId}`);
  }
}
```

## Development & publishing

```bash
pnpm install
pnpm typecheck
pnpm build          # tsup → dist/ (ESM + CJS + types)
pnpm pack           # inspect the publish tarball
npm login           # one-time auth for your npm account
npm publish         # requires an account with access to the @sintaksdev scope
```

`prepublishOnly` runs the build automatically, so `npm publish` ships fresh `dist/`. Publish to a different registry (e.g. GitHub Packages, Verdaccio) with `npm publish --registry <url>`.