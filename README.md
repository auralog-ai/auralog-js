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
| `endpoint` | `string` | `https://ingest.auralog.ai` | Ingest endpoint override |
| `flushInterval` | `number` | `5000` | Ms between batched flushes |
| `captureConsole` | `boolean` | `false` | Forward `console.*` calls |
| `captureErrors` | `boolean` | `true` | Capture uncaught errors and unhandled rejections |

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
