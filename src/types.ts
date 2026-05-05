export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

export function isAtOrAboveLevel(level: LogLevel, threshold: LogLevel): boolean {
  return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[threshold];
}

export const DEFAULT_FLUSH_INTERVAL_MS = 5000;
export const DEFAULT_MAX_QUEUE_SIZE = 1000;

/**
 * Static map or sync supplier. The supplier form is invoked on every log
 * emission so values like `currentUser?.id` reflect host state at log time.
 *
 * Async suppliers (returning a thenable) are not supported — they would add
 * await latency to every log emit. See spec 2026-04-25-global-metadata.md.
 */
export type GlobalMetadata =
  | Record<string, unknown>
  | (() => Record<string, unknown>);

export interface AuralogConfig {
  apiKey: string;
  environment?: string;
  captureConsole?: boolean;
  captureErrors?: boolean;
  flushInterval?: number;
  endpoint?: string;
  /**
   * Maximum number of buffered log entries before the transport drops the
   * oldest entries. Prevents unbounded memory growth when the ingest endpoint
   * is unreachable. Defaults to 1000.
   */
  maxQueueSize?: number;
  /**
   * Allow `endpoint` to use plaintext `http://`. Off by default — a misconfigured
   * `AURALOG_ENDPOINT=http://...` would otherwise silently downgrade every POST
   * (including the API key in the body) to plaintext. Opt in for local dev.
   */
  allowInsecureEndpoint?: boolean;
  traceId?: string;
  /**
   * Baseline metadata merged into every log entry (direct API, captureConsole,
   * captureErrors). Per-call metadata wins on key collision (shallow merge).
   *
   * The supplier form is invoked on every emission — keep it O(1) cheap.
   */
  globalMetadata?: GlobalMetadata;
}

export interface InternalLogEntry {
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  environment?: string;
  timestamp: string;
  traceId?: string;
}
