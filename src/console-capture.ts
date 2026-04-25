import type { LogLevel, InternalLogEntry } from "./types.js";

/**
 * Capture paths receive a builder rather than a raw handler so that the
 * `globalMetadata` merge applied to direct API calls also applies here —
 * see Logger.buildEntry. Capture paths previously emitted entries with no
 * `metadata` field at all; routing through the builder fixes that.
 */
export type CaptureEntryBuilder = (
  partial: Omit<InternalLogEntry, "timestamp" | "environment" | "traceId" | "metadata"> & {
    metadata?: Record<string, unknown>;
  },
) => InternalLogEntry;

type Emit = (entry: InternalLogEntry) => void;

const METHOD_TO_LEVEL: Record<string, LogLevel> = {
  log: "info",
  warn: "warn",
  error: "error",
};

let originals: Record<string, (...args: unknown[]) => void> | null = null;

export function startConsoleCapture(emit: Emit, build: CaptureEntryBuilder): void {
  if (originals) return;
  originals = { log: console.log, warn: console.warn, error: console.error };

  for (const [method, level] of Object.entries(METHOD_TO_LEVEL)) {
    const original = originals[method];
    (console as unknown as Record<string, (...args: unknown[]) => void>)[method] = (...args: unknown[]) => {
      const message = args.map(String).join(" ");
      emit(build({ level, message }));
      original.apply(console, args);
    };
  }
}

export function stopConsoleCapture(): void {
  if (!originals) return;
  console.log = originals.log as typeof console.log;
  console.warn = originals.warn as typeof console.warn;
  console.error = originals.error as typeof console.error;
  originals = null;
}
