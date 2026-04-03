import type { LogLevel } from "@auralog/shared";

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
  timestamp: string;
}
