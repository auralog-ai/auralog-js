import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startErrorCapture, stopErrorCapture } from "../src/error-capture.js";
import type { InternalLogEntry } from "../src/types.js";

describe("Error Capture (Node.js)", () => {
  let captured: InternalLogEntry[];
  beforeEach(() => { captured = []; });
  afterEach(() => { stopErrorCapture(); });

  it("captures uncaughtException as fatal", () => {
    startErrorCapture((entry) => captured.push(entry));
    process.emit("uncaughtException", new Error("test crash"));
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("fatal");
    expect(captured[0].message).toBe("test crash");
    expect(captured[0].stackTrace).toBeDefined();
  });

  it("captures unhandledRejection as error", () => {
    startErrorCapture((entry) => captured.push(entry));
    process.emit("unhandledRejection", new Error("unhandled promise"), Promise.resolve());
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("error");
    expect(captured[0].message).toBe("unhandled promise");
  });

  it("handles non-Error rejections", () => {
    startErrorCapture((entry) => captured.push(entry));
    process.emit("unhandledRejection", "string rejection", Promise.resolve());
    expect(captured).toHaveLength(1);
    expect(captured[0].message).toBe("string rejection");
    expect(captured[0].stackTrace).toBeUndefined();
  });

  it("stops capturing after stopErrorCapture", () => {
    startErrorCapture((entry) => captured.push(entry));
    stopErrorCapture();
    // Add a no-op listener so Node doesn't re-throw the emitted exception
    const noop = () => {};
    process.on("uncaughtException", noop);
    process.emit("uncaughtException", new Error("should not capture"));
    process.removeListener("uncaughtException", noop);
    expect(captured).toHaveLength(0);
  });
});
