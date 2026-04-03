import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger } from "../src/logger.js";
import type { InternalLogEntry } from "../src/types.js";

describe("Logger", () => {
  let logs: InternalLogEntry[];
  let logger: Logger;

  beforeEach(() => {
    logs = [];
    logger = new Logger("test-env", (entry) => { logs.push(entry); });
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
});
