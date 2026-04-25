import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger } from "../src/logger.js";
import { MetadataMerger } from "../src/metadata.js";
import type { InternalLogEntry } from "../src/types.js";

describe("Logger", () => {
  let logs: InternalLogEntry[];
  let logger: Logger;

  beforeEach(() => {
    logs = [];
    logger = new Logger("test-env", (entry) => { logs.push(entry); }, new MetadataMerger(undefined));
  });

  it("logs at each level with correct level field", () => {
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    logger.fatal("f");
    expect(logs.map((l) => l.level)).toEqual(["debug", "info", "warn", "error", "fatal"]);
  });

  it("includes message and metadata", () => {
    logger.info("hello", { userId: "abc" });
    expect(logs[0].message).toBe("hello");
    expect(logs[0].metadata).toEqual({ userId: "abc" });
  });

  it("includes ISO timestamp", () => {
    logger.info("test");
    const ts = new Date(logs[0].timestamp);
    expect(ts.getTime()).not.toBeNaN();
  });

  it("stamps environment on each log entry", () => {
    logger.info("test");
    expect(logs[0].environment).toBe("test-env");
  });

  it("auto-generates a trace ID when none is provided", () => {
    logger.info("test");
    expect(logs[0].traceId).toBeDefined();
    expect(typeof logs[0].traceId).toBe("string");
    expect(logs[0].traceId!.length).toBeGreaterThan(0);
  });

  it("uses provided trace ID", () => {
    const tracedLogger = new Logger("test-env", (entry) => { logs.push(entry); }, new MetadataMerger(undefined), "my-trace-123");
    tracedLogger.info("test");
    expect(logs[0].traceId).toBe("my-trace-123");
  });

  it("allows per-log trace ID override via metadata.traceId", () => {
    logger.info("test", { traceId: "override-123", extra: "data" });
    expect(logs[0].traceId).toBe("override-123");
    expect(logs[0].metadata).toEqual({ extra: "data" });
    expect(logs[0].metadata).not.toHaveProperty("traceId");
  });

  it("getTraceId returns current trace ID", () => {
    logger.info("test");
    expect(logger.getTraceId()).toBe(logs[0].traceId);
  });

  it("setTraceId changes trace ID for subsequent logs", () => {
    logger.info("before");
    const oldTraceId = logs[0].traceId;
    logger.setTraceId("new-trace-456");
    logger.info("after");
    expect(logs[1].traceId).toBe("new-trace-456");
    expect(logs[1].traceId).not.toBe(oldTraceId);
  });
});
