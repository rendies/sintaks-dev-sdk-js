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
  model: "flux-schnell",
  prompt: "A futuristic Jakarta skyline at dusk",
});
console.log(images.data[0]?.url);
```

`model` defaults to `claude-sonnet-5-5` when omitted. Point at another environment with `baseURL`:

```ts
const client = new Sintaks({ apiKey: "sk-...", baseURL: "http://localhost:8080" });
```

## Errors

Failures throw `SintaksError` with `status`, `type`, `code`, and `requestId` (the gateway `X-Request-ID`, useful for support).

```ts
try {
  await client.chat.completions.create({ messages: [{ role: "user", content: "x" }] });
} catch (err) {
  if (err instanceof SintaksError && err.status === 402) {
    console.error("insufficient balance, top up first");
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