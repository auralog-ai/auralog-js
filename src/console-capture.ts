import type { LogLevel } from "@auralog/shared";
import type { InternalLogEntry } from "./types.js";

type LogHandler = (entry: InternalLogEntry) => void;

const METHOD_TO_LEVEL: Record<string, LogLevel> = {
  log: "info",
  warn: "warn",
  error: "error",
};

let originals: Record<string, (...args: unknown[]) => void> | null = null;

export function startConsoleCapture(handler: LogHandler): void {
  if (originals) return;
  originals = { log: console.log, warn: console.warn, error: console.error };

  for (const [method, level] of Object.entries(METHOD_TO_LEVEL)) {
    const original = originals[method];
    (console as unknown as Record<string, (...args: unknown[]) => void>)[method] = (...args: unknown[]) => {
      handler({ level, message: args.map(String).join(" "), timestamp: new Date().toISOString() });
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
