export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

export function isAtOrAboveLevel(level: LogLevel, threshold: LogLevel): boolean {
  return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[threshold];
}

export const DEFAULT_FLUSH_INTERVAL_MS = 5000;

export interface AuralogConfig {
  apiKey: string;
  environment?: string;
  captureConsole?: boolean;
  captureErrors?: boolean;
  flushInterval?: number;
  endpoint?: string;
}

export interface InternalLogEntry {
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  environment?: string;
  timestamp: string;
}
