# auralog-sdk

JavaScript/TypeScript SDK for [Auralog](https://auralog.ai) — agentic logging and application awareness.

Auralog uses Claude as an on-call engineer: it monitors your logs and errors, alerts you when something's wrong, and opens fix PRs automatically.

[![npm version](https://img.shields.io/npm/v/auralog-sdk.svg)](https://www.npmjs.com/package/auralog-sdk)
[![provenance verified](https://img.shields.io/badge/provenance-verified-2dba4e?logo=sigstore&logoColor=white)](https://www.npmjs.com/package/auralog-sdk)
[![license](https://img.shields.io/npm/l/auralog-sdk.svg)](./LICENSE)

## Install

```bash
npm install auralog-sdk
```

## Quick start

```ts
import { auralog, init } from "auralog-sdk";

init({
  apiKey: process.env.AURALOG_API_KEY!,
  environment: "production",
  captureConsole: true,  // forward console.* to Auralog
  captureErrors: true,   // capture uncaught errors (default: true)
});

auralog.info("user signed in", { userId: "123" });
auralog.error("payment failed", { orderId: "abc" });
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | _required_ | Your Auralog project API key |
| `environment` | `string` | _required_ | e.g. `"production"`, `"staging"`, `"dev"` |
| `endpoint` | `string` | `https://ingest.auralog.ai` | Ingest endpoint override. Must be `https://` unless `allowInsecureEndpoint` is set. |
| `allowInsecureEndpoint` | `boolean` | `false` | Permit `http://` endpoints (e.g. `http://localhost:8080` for local dev). Off by default — a plaintext endpoint would leak the API key on the wire. |
| `flushInterval` | `number` | `5000` | Ms between batched flushes |
| `maxQueueSize` | `number` | `1000` | Max buffered log entries before the SDK drops the oldest. Bounds memory if the ingest endpoint is unreachable. |
| `captureConsole` | `boolean` | `false` | Forward `console.*` calls |
| `captureErrors` | `boolean` | `true` | Capture uncaught errors and unhandled rejections |
| `traceId` | `string` | _auto-generated_ | Custom trace ID for distributed tracing |
| `globalMetadata` | `Record<string, unknown>` or `() => Record<string, unknown>` | `undefined` | Baseline metadata merged into every log entry — including `captureConsole` and `captureErrors` entries. Per-call metadata wins on key collision (shallow merge). |

## Attaching session-scoped fields to every log

Use `globalMetadata` to attach things like `user_id`, org id, or feature-flag snapshots to every log Auralog emits — including `console.*` captures and uncaught errors. The supplier form is the canonical recipe because it's evaluated at log time, so it always sees the current host state:

```ts
import { auralog, init } from "auralog-sdk";

init({
  apiKey: process.env.AURALOG_API_KEY!,
  environment: "production",
  captureConsole: true,
  captureErrors: true,
  globalMetadata: () => ({
    user_id: currentUser?.id,
    org_id: currentUser?.orgId,
  }),
});

auralog.info("checkout started");
// metadata: { user_id: "...", org_id: "..." }

auralog.info("admin impersonating", { user_id: "impersonated-id" });
// per-call wins: { user_id: "impersonated-id", org_id: "..." }
```

A few caveats:

- **Sync only.** The supplier must return synchronously. If it returns a `Promise` (or any thenable), Auralog drops `globalMetadata` for that entry, warns once, and ships the entry without it. Cache async state on the sync side (e.g. in a context-local) before reading it here.
- **Keep it cheap.** The supplier runs on every log emission. Avoid I/O or expensive computation.
- **If it throws or produces a non-serializable value**, the entry is still delivered — just without `globalMetadata`. Auralog warns once per logger instance and stays silent thereafter.

## Graceful shutdown

```ts
import { shutdown } from "auralog-sdk";

process.on("SIGTERM", async () => {
  await shutdown();  // flushes pending logs
  process.exit(0);
});
```

## Documentation

Full docs at [docs.auralog.ai](https://docs.auralog.ai).

## Verify this package

Every release is published with [sigstore provenance attestations](https://docs.npmjs.com/generating-provenance-statements) built directly in GitHub Actions. The attestation proves the tarball was built from a specific commit in this repository via `.github/workflows/release.yml` — without having to trust npm or the maintainer.

To verify in your own project:

```bash
npm audit signatures
```

Or inspect the attestation on [npmjs.com/package/auralog-sdk](https://www.npmjs.com/package/auralog-sdk) under "Provenance".

## Security

Found a vulnerability? See [SECURITY.md](./SECURITY.md) for how to report it.

## License

[MIT](./LICENSE) © James Thomas
