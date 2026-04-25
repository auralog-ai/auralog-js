import type { InternalLogEntry } from "./types.js";
import type { CaptureEntryBuilder } from "./console-capture.js";

type Emit = (entry: InternalLogEntry) => void;

const isBrowser = typeof window !== "undefined";
const isNode = typeof process !== "undefined" && typeof process.on === "function";

let uncaughtHandler: ((err: Error) => void) | null = null;
let rejectionHandler: ((reason: unknown) => void) | null = null;
let browserErrorHandler: ((event: ErrorEvent) => void) | null = null;
let browserRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

export function startErrorCapture(emit: Emit, build: CaptureEntryBuilder): void {
  if (uncaughtHandler || browserErrorHandler) return;

  if (isNode) {
    uncaughtHandler = (error: Error) => {
      emit(build({ level: "fatal", message: error.message, stackTrace: error.stack }));
    };
    rejectionHandler = (reason: unknown) => {
      const isError = reason instanceof Error;
      emit(
        build({
          level: "error",
          message: isError ? reason.message : String(reason),
          stackTrace: isError ? reason.stack : undefined,
        }),
      );
    };
    process.on("uncaughtException", uncaughtHandler);
    process.on("unhandledRejection", rejectionHandler);
  } else if (isBrowser) {
    browserErrorHandler = (event: ErrorEvent) => {
      emit(
        build({
          level: "fatal",
          message: event.message,
          stackTrace: event.error?.stack,
        }),
      );
    };
    browserRejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const isError = reason instanceof Error;
      emit(
        build({
          level: "error",
          message: isError ? reason.message : String(reason),
          stackTrace: isError ? reason.stack : undefined,
        }),
      );
    };
    window.addEventListener("error", browserErrorHandler);
    window.addEventListener("unhandledrejection", browserRejectionHandler);
  }
}

export function stopErrorCapture(): void {
  if (uncaughtHandler) { process.removeListener("uncaughtException", uncaughtHandler); uncaughtHandler = null; }
  if (rejectionHandler) { process.removeListener("unhandledRejection", rejectionHandler); rejectionHandler = null; }
  if (browserErrorHandler) { window.removeEventListener("error", browserErrorHandler); browserErrorHandler = null; }
  if (browserRejectionHandler) { window.removeEventListener("unhandledrejection", browserRejectionHandler); browserRejectionHandler = null; }
}
