import type { LogLevel } from "./types.js";
import type { InternalLogEntry } from "./types.js";

export type LogHandler = (entry: InternalLogEntry) => void;

export class Logger {
  private environment: string | undefined;
  private handler: LogHandler;

  constructor(environment: string | undefined, handler: LogHandler) {
    this.environment = environment;
    this.handler = handler;
  }

  debug(message: string, metadata?: Record<string, unknown>): void { this.log("debug", message, metadata); }
  info(message: string, metadata?: Record<string, unknown>): void { this.log("info", message, metadata); }
  warn(message: string, metadata?: Record<string, unknown>): void { this.log("warn", message, metadata); }
  error(message: string, metadata?: Record<string, unknown>, stackTrace?: string): void { this.log("error", message, metadata, stackTrace); }
  fatal(message: string, metadata?: Record<string, unknown>, stackTrace?: string): void { this.log("fatal", message, metadata, stackTrace); }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, stackTrace?: string): void {
    this.handler({ level, message, metadata, stackTrace, environment: this.environment, timestamp: new Date().toISOString() });
  }
}
