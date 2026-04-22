import type { LogLevel } from "./types.js";
import type { InternalLogEntry } from "./types.js";

export type LogHandler = (entry: InternalLogEntry) => void;

function generateTraceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class Logger {
  private environment: string | undefined;
  private handler: LogHandler;
  private traceId: string;

  constructor(environment: string | undefined, handler: LogHandler, traceId?: string) {
    this.environment = environment;
    this.handler = handler;
    this.traceId = traceId ?? generateTraceId();
  }

  getTraceId(): string {
    return this.traceId;
  }

  setTraceId(id: string): void {
    this.traceId = id;
  }

  debug(message: string, metadata?: Record<string, unknown>): void { this.log("debug", message, metadata); }
  info(message: string, metadata?: Record<string, unknown>): void { this.log("info", message, metadata); }
  warn(message: string, metadata?: Record<string, unknown>): void { this.log("warn", message, metadata); }
  error(message: string, metadata?: Record<string, unknown>, stackTrace?: string): void { this.log("error", message, metadata, stackTrace); }
  fatal(message: string, metadata?: Record<string, unknown>, stackTrace?: string): void { this.log("fatal", message, metadata, stackTrace); }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, stackTrace?: string): void {
    let entryTraceId = this.traceId;

    if (metadata && "traceId" in metadata) {
      entryTraceId = metadata.traceId as string;
      const { traceId: _, ...rest } = metadata;
      metadata = Object.keys(rest).length > 0 ? rest : undefined;
    }

    this.handler({ level, message, metadata, stackTrace, environment: this.environment, timestamp: new Date().toISOString(), traceId: entryTraceId });
  }
}
