# Changelog

All notable changes to `auralog-sdk` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - Unreleased

### Added

- **`globalMetadata` config field.** Attach session-scoped fields (e.g.
  `user_id`, org id, feature-flag snapshot) to every log entry without
  threading them through every call site. Accepts either a static
  `Record<string, unknown>` or a synchronous supplier
  `() => Record<string, unknown>`; the supplier form is invoked at every
  emission so values like `currentUser?.id` reflect host state at log time.
  Per-call metadata wins on key collision (shallow merge). See README for
  the canonical "attach `user_id` to every log" recipe.

### Changed

- **`captureConsole` and `captureErrors` entries now carry merged metadata.**
  Previously these emission paths produced entries with no `metadata` field
  at all, so console-captured logs and uncaught errors landed in Auralog
  without any host attribution. They now route through the same merge
  pipeline as direct `auralog.info(...)` calls and pick up `globalMetadata`.
  This is a non-breaking wire change — `metadata` was already optional on
  the wire and the ingest worker already accepts it.

### Behavior contract for `globalMetadata`

- Synchronous only. A supplier that returns a thenable is treated as a
  failure: the entry is shipped without `globalMetadata` and a single
  `console.warn` fires per logger instance.
- A supplier that throws is swallowed with the same warn-once behavior;
  logging never crashes the host.
- If the merged metadata isn't JSON-serializable (circular refs, `BigInt`,
  symbols, etc.), `globalMetadata` is dropped for that entry and the entry
  still ships with just per-call metadata.

## [0.1.6] - 2026-04

### Added

- Auto-generated trace IDs with per-log override via `metadata.traceId`.
- `traceId` config option, `getTraceId()`, `setTraceId()` exports.
