import { DEFAULT_FLUSH_INTERVAL_MS } from "@auralog/shared";
import { Logger } from "./logger.js";
import { Transport } from "./transport.js";
import { startConsoleCapture, stopConsoleCapture } from "./console-capture.js";
import { startErrorCapture, stopErrorCapture } from "./error-capture.js";
import type { AuralogConfig } from "./types.js";

let logger: Logger | null = null;
let transport: Transport | null = null;

const DEFAULT_ENDPOINT = "https://ingest.auralog.dev";

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

  logger = new Logger(config.environment, (entry) => { transport!.send(entry); });

  if (config.captureConsole) {
    startConsoleCapture((entry) => transport!.send(entry));
  }

  if (config.captureErrors !== false) {
    startErrorCapture((entry) => transport!.send(entry));
  }

  return { flush: () => transport!.flush() };
}

export function shutdown(): void {
  stopConsoleCapture();
  stopErrorCapture();
  if (transport) { transport.shutdown(); transport = null; }
  logger = null;
}

function assertInitialized(): Logger {
  if (!logger) throw new Error("auralog.init() must be called before using the logger");
  return logger;
}

export const auralog = {
  debug(message: string, metadata?: Record<string, unknown>) { assertInitialized().debug(message, metadata); },
  info(message: string, metadata?: Record<string, unknown>) { assertInitialized().info(message, metadata); },
  warn(message: string, metadata?: Record<string, unknown>) { assertInitialized().warn(message, metadata); },
  error(message: string, metadata?: Record<string, unknown>, stackTrace?: string) { assertInitialized().error(message, metadata, stackTrace); },
  fatal(message: string, metadata?: Record<string, unknown>, stackTrace?: string) { assertInitialized().fatal(message, metadata, stackTrace); },
};

export type { AuralogConfig } from "./types.js";
