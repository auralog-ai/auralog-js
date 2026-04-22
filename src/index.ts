import { DEFAULT_FLUSH_INTERVAL_MS } from "./types.js";
import { Logger } from "./logger.js";
import { Transport } from "./transport.js";
import { startConsoleCapture, stopConsoleCapture } from "./console-capture.js";
import { startErrorCapture, stopErrorCapture } from "./error-capture.js";
import type { AuralogConfig } from "./types.js";

let logger: Logger | null = null;
let transport: Transport | null = null;

const DEFAULT_ENDPOINT = "https://ingest.auralog.ai";

export function init(
  config: AuralogConfig,
  fetchFn?: typeof fetch
): { flush: () => Promise<void> } {
  transport = new Transport({
    apiKey: config.apiKey,
    endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
    flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL_MS,
    fetchFn,
  });

  logger = new Logger(config.environment, (entry) => { transport!.send(entry); }, config.traceId);

  if (config.captureConsole) {
    startConsoleCapture((entry) => transport!.send(entry), config.environment);
  }

  if (config.captureErrors !== false) {
    startErrorCapture((entry) => transport!.send(entry), config.environment);
  }

  return { flush: () => transport!.flush() };
}

export async function shutdown(): Promise<void> {
  stopConsoleCapture();
  stopErrorCapture();
  if (transport) {
    await transport.flush();
    transport.shutdown();
    transport = null;
  }
  logger = null;
}

function assertInitialized(): Logger {
  if (!logger) throw new Error("auralog.init() must be called before using the logger");
  return logger;
}

export function getTraceId(): string {
  return assertInitialized().getTraceId();
}

export function setTraceId(id: string): void {
  assertInitialized().setTraceId(id);
}

export const auralog = {
  debug(message: string, metadata?: Record<string, unknown>) { assertInitialized().debug(message, metadata); },
  info(message: string, metadata?: Record<string, unknown>) { assertInitialized().info(message, metadata); },
  warn(message: string, metadata?: Record<string, unknown>) { assertInitialized().warn(message, metadata); },
  error(message: string, metadata?: Record<string, unknown>, stackTrace?: string) { assertInitialized().error(message, metadata, stackTrace); },
  fatal(message: string, metadata?: Record<string, unknown>, stackTrace?: string) { assertInitialized().fatal(message, metadata, stackTrace); },
};

export type { AuralogConfig, LogLevel } from "./types.js";
