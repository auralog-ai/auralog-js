import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startConsoleCapture, stopConsoleCapture } from "../src/console-capture.js";
import type { InternalLogEntry } from "../src/types.js";

describe("Console Capture", () => {
  let captured: InternalLogEntry[];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => { captured = []; });
  afterEach(() => {
    stopConsoleCapture();
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it("intercepts console.log as info level", () => {
    startConsoleCapture((entry) => captured.push(entry));
    console.log("hello world");
    stopConsoleCapture();
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("info");
    expect(captured[0].message).toBe("hello world");
  });

  it("intercepts console.warn as warn level", () => {
    startConsoleCapture((entry) => captured.push(entry));
    console.warn("careful");
    stopConsoleCapture();
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("warn");
  });

  it("intercepts console.error as error level", () => {
    startConsoleCapture((entry) => captured.push(entry));
    console.error("bad");
    stopConsoleCapture();
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("error");
  });

  it("still calls the original console method", () => {
    const spy = vi.fn();
    console.log = spy;
    startConsoleCapture((entry) => captured.push(entry));
    console.log("test");
    stopConsoleCapture();
    expect(spy).toHaveBeenCalledWith("test");
  });

  it("restores original methods on stop", () => {
    startConsoleCapture((entry) => captured.push(entry));
    stopConsoleCapture();
    expect(console.log).toBe(originalLog);
    expect(console.warn).toBe(originalWarn);
    expect(console.error).toBe(originalError);
  });
});
