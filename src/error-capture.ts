import type { InternalLogEntry } from "./types.js";

type LogHandler = (entry: InternalLogEntry) => void;

let uncaughtHandler: ((err: Error) => void) | null = null;
let rejectionHandler: ((reason: unknown) => void) | null = null;

export function startErrorCapture(handler: LogHandler): void {
  if (uncaughtHandler) return;

  uncaughtHandler = (err: Error) => {
    handler({ level: "fatal", message: err.message, stackTrace: err.stack, timestamp: new Date().toISOString() });
  };

  rejectionHandler = (reason: unknown) => {
    const isError = reason instanceof Error;
    handler({
      level: "error",
      message: isError ? reason.message : String(reason),
      stackTrace: isError ? reason.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  };

  process.on("uncaughtException", uncaughtHandler);
  process.on("unhandledRejection", rejectionHandler);
}

export function stopErrorCapture(): void {
  if (uncaughtHandler) { process.removeListener("uncaughtException", uncaughtHandler); uncaughtHandler = null; }
  if (rejectionHandler) { process.removeListener("unhandledRejection", rejectionHandler); rejectionHandler = null; }
}
