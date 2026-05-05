import { DEFAULT_FLUSH_INTERVAL_MS, DEFAULT_MAX_QUEUE_SIZE } from "./types.js";
import { Logger } from "./logger.js";
import { MetadataMerger } from "./metadata.js";
import { Transport } from "./transport.js";
import { startConsoleCapture, stopConsoleCapture } from "./console-capture.js";
import { startErrorCapture, stopErrorCapture } from "./error-capture.js";
import type { AuralogConfig, InternalLogEntry } from "./types.js";

let logger: Logger | null = null;
let transport: Transport | null = null;

const DEFAULT_ENDPOINT = "https://ingest.auralog.ai";

function validateEndpoint(endpoint: string, allowInsecure: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(
      `auralog: invalid endpoint "${endpoint}" — must be a valid URL`,
    );
  }
  if (parsed.protocol === "https:") return;
  if (parsed.protocol === "http:" && allowInsecure) return;
  throw new Error(
    `auralog: refusing to use non-https endpoint "${endpoint}". ` +
      `The API key is sent in the request body, so plaintext http:// would ` +
      `leak it on the wire. Set allowInsecureEndpoint: true to opt in ` +
      `(intended for local development only).`,
  );
}

function validatePositiveInteger(value: unknown, name: string): void {
  // `??` only catches null/undefined, so a caller passing `0`, `-1`, or `NaN`
  // here would silently produce broken behavior (e.g. maxQueueSize: 0 drains
  // the buffer on every send). Validate explicitly.
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `auralog: ${name} must be a positive integer (got ${String(value)})`,
    );
  }
}

export function init(
  config: AuralogConfig,
  fetchFn?: typeof fetch
): { flush: () => Promise<void> } {
  const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  validateEndpoint(endpoint, config.allowInsecureEndpoint === true);
  validatePositiveInteger(config.maxQueueSize, "maxQueueSize");
  validatePositiveInteger(config.flushInterval, "flushInterval");

  transport = new Transport({
    apiKey: config.apiKey,
    endpoint,
    flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL_MS,
    maxQueueSize: config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
    fetchFn,
  });

  const merger = new MetadataMerger(config.globalMetadata);
  const activeLogger = new Logger(
    config.environment,
    (entry) => { transport!.send(entry); },
    merger,
    config.traceId,
  );
  logger = activeLogger;

  // Capture paths route through logger.buildEntry so they pick up the same
  // metadata merge (globalMetadata + per-call) used by the direct API.
  const build = activeLogger.buildEntry.bind(activeLogger);
  const emit = (entry: InternalLogEntry) => transport!.send(entry);

  if (config.captureConsole) {
    startConsoleCapture(emit, build);
  }

  if (config.captureErrors !== false) {
    startErrorCapture(emit, build);
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

export type { AuralogConfig, GlobalMetadata, LogLevel } from "./types.js";
