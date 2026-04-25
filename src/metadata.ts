import type { GlobalMetadata } from "./types.js";

type WarnFn = (message: string, ...args: unknown[]) => void;

/**
 * MetadataMerger encapsulates the "resolve globalMetadata + shallow-merge
 * with per-call metadata + serialization defense" pipeline used by every
 * emission path (direct API, console capture, error capture).
 *
 * Behavior contract (see spec 2026-04-25-global-metadata.md):
 *   - Supplier is invoked at every emission (late binding), never pre-resolved.
 *   - Synchronous only. A thenable return is treated as a failure.
 *   - Throws are swallowed.
 *   - On any failure (throw, thenable, non-serializable result) we warn ONCE
 *     per merger instance via console.warn, then go silent.
 *   - On failure the entry is still emitted, with per-call metadata only
 *     (or no metadata field at all if per-call is also absent).
 *   - Merge is shallow: { ...resolveGlobal(), ...perCall }.
 *   - Both empty -> undefined (so the wire payload omits `metadata`).
 */
export class MetadataMerger {
  private global: GlobalMetadata | undefined;
  private warned = false;
  private warn: WarnFn;

  constructor(global: GlobalMetadata | undefined, warn: WarnFn = console.warn.bind(console)) {
    this.global = global;
    this.warn = warn;
  }

  /**
   * Returns the merged metadata for an entry, or undefined if both sides
   * are empty. Never throws — failures fall back to per-call only.
   */
  merge(perCall: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    const resolved = this.resolveGlobal();
    if (!resolved) {
      return perCall && Object.keys(perCall).length > 0 ? perCall : undefined;
    }

    const merged: Record<string, unknown> = { ...resolved, ...(perCall ?? {}) };
    if (Object.keys(merged).length === 0) return undefined;

    if (!isJsonSerializable(merged)) {
      this.warnOnce(
        "auralog: globalMetadata produced a non-JSON-serializable value; emitting entry without it",
      );
      return perCall && Object.keys(perCall).length > 0 ? perCall : undefined;
    }

    return merged;
  }

  private resolveGlobal(): Record<string, unknown> | undefined {
    if (!this.global) return undefined;

    if (typeof this.global !== "function") {
      // Static map form. Validate on first use that it's an object.
      return this.global;
    }

    let value: unknown;
    try {
      value = this.global();
    } catch (error) {
      this.warnOnce("auralog: globalMetadata supplier threw; emitting entry without it", error);
      return undefined;
    }

    if (isThenable(value)) {
      this.warnOnce(
        "auralog: globalMetadata supplier returned a thenable; async suppliers are not supported. Emitting entry without it.",
      );
      return undefined;
    }

    if (value === null || typeof value !== "object") {
      this.warnOnce(
        "auralog: globalMetadata supplier returned a non-object; emitting entry without it",
      );
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private warnOnce(message: string, ...args: unknown[]): void {
    if (this.warned) return;
    this.warned = true;
    this.warn(message, ...args);
  }
}

function isThenable(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function isJsonSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}
