import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transport } from "../src/transport.js";
import type { InternalLogEntry } from "../src/types.js";

function makeEntry(level: "debug" | "info" | "warn" | "error" | "fatal" = "info", message = "test"): InternalLogEntry {
  return { level, message, timestamp: new Date().toISOString() };
}

describe("Transport", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let transport: Transport;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    transport = new Transport({ apiKey: "aura_test", endpoint: "https://ingest.auralog.dev", flushInterval: 5000, fetchFn: fetchSpy });
  });

  afterEach(() => { transport.shutdown(); vi.useRealTimers(); });

  it("batches logs and flushes on interval", async () => {
    transport.send(makeEntry("info", "one"));
    transport.send(makeEntry("info", "two"));
    expect(fetchSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.logs).toHaveLength(2);
    expect(body.projectApiKey).toBe("aura_test");
  });

  it("flushes immediately for error level", async () => {
    transport.send(makeEntry("error", "boom"));
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://ingest.auralog.dev/v1/logs/single");
  });

  it("flushes immediately for fatal level", async () => {
    transport.send(makeEntry("fatal", "crash"));
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://ingest.auralog.dev/v1/logs/single");
  });

  it("does not flush when buffer is empty", async () => {
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("flush() sends remaining logs", async () => {
    transport.send(makeEntry("info", "pending"));
    await transport.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
