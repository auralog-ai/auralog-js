import type { LogLevel, InternalLogEntry } from "./types.js";
import { MetadataMerger } from "./metadata.js";

export type LogHandler = (entry: InternalLogEntry) => void;

function generateTraceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (placeholder) => {
    const random = (Math.random() * 16) | 0;
    return (placeholder === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export class Logger {
  private environment: string | undefined;
  private handler: LogHandler;
  private traceId: string;
  private merger: MetadataMerger;

  constructor(
    environment: string | undefined,
    handler: LogHandler,
    merger: MetadataMerger,
    traceId?: string,
  ) {
    this.environment = environment;
    this.handler = handler;
    this.merger = merger;
    this.traceId = traceId ?? generateTraceId();
  }

  getTraceId(): string {
    return this.traceId;
  }

  setTraceId(id: string): void {
    this.traceId = id;
  }

  /**
   * Build an entry for an emission path that already has level/message/etc.
   * decided (e.g. console-capture, error-capture). Applies the same metadata
   * merge that direct API calls go through. Exposed so capture paths route
   * through the single choke-point and pick up `globalMetadata`.
   */
  buildEntry(partial: Omit<InternalLogEntry, "timestamp" | "environment" | "traceId" | "metadata"> & {
    metadata?: Record<string, unknown>;
  }): InternalLogEntry {
    const merged = this.merger.merge(partial.metadata);
    return {
      level: partial.level,
      message: partial.message,
      stackTrace: partial.stackTrace,
      metadata: merged,
      environment: this.environment,
      timestamp: new Date().toISOString(),
      traceId: this.traceId,
    };
  }

  debug(message: string, metadata?: Record<string, unknown>): void { this.log("debug", message, metadata); }
  info(message: string, metadata?: Record<string, unknown>): void { this.log("info", message, metadata); }
  warn(message: string, metadata?: Record<string, unknown>): void { this.log("warn", message, metadata); }
  error(message: string, metadata?: Record<string, unknown>, stackTrace?: string): void { this.log("error", message, metadata, stackTrace); }
  fatal(message: string, metadata?: Record<string, unknown>, stackTrace?: string): void { this.log("fatal", message, metadata, stackTrace); }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, stackTrace?: string): void {
    let entryTraceId = this.traceId;
    let perCallMetadata = metadata;

    if (perCallMetadata && "traceId" in perCallMetadata) {
      entryTraceId = perCallMetadata.traceId as string;
      const { traceId: _ignored, ...rest } = perCallMetadata;
      perCallMetadata = Object.keys(rest).length > 0 ? rest : undefined;
    }

    const merged = this.merger.merge(perCallMetadata);

    this.handler({
      level,
      message,
      metadata: merged,
      stackTrace,
      environment: this.environment,
      timestamp: new Date().toISOString(),
      traceId: entryTraceId,
    });
  }
}
