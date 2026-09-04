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
    transport = new Transport({ apiKey: "aura_test", endpoint: "https://ingest.auralogs.ai", flushInterval: 5000, maxQueueSize: 1000, fetchFn: fetchSpy });
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
    expect(fetchSpy.mock.calls[0][0]).toBe("https://ingest.auralogs.ai/v1/logs/single");
  });

  it("flushes immediately for fatal level", async () => {
    transport.send(makeEntry("fatal", "crash"));
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://ingest.auralogs.ai/v1/logs/single");
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

  describe("redirect handling (Workers-compatible)", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
    afterEach(() => { warnSpy.mockRestore(); });

    it("refuses a 3xx response without re-sending the body", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 307, type: "basic" } as Response);
      transport.send(makeEntry("info", "redirected"));
      await transport.flush();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("refused to follow a redirect"));
    });

    it("refuses an opaque redirect (browser manual mode) the same way", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 0, type: "opaqueredirect" } as Response);
      transport.send(makeEntry("error", "opaque"));
      await Promise.resolve();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("refused to follow a redirect"));
    });

    it("warns on a non-2xx ingest response instead of dropping silently", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 401, type: "basic" } as Response);
      transport.send(makeEntry("info", "unauthorized"));
      await transport.flush();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ingest responded 401"));
    });

    it("stays quiet on a 2xx response", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, type: "basic" } as Response);
      transport.send(makeEntry("info", "fine"));
      await transport.flush();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("network error handling", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let unhandled: unknown[];
    let unhandledListener: (e: PromiseRejectionEvent | { reason: unknown }) => void;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      unhandled = [];
      unhandledListener = (e: any) => { unhandled.push(e.reason ?? e); };
      process.on("unhandledRejection", unhandledListener as any);
    });

    afterEach(() => {
      warnSpy.mockRestore();
      process.off("unhandledRejection", unhandledListener as any);
    });

    it("flush() does not throw when fetch rejects", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("network down"));
      transport.send(makeEntry("info", "lost"));
      await expect(transport.flush()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith("auralogs: failed to send logs", expect.any(Error));
    });

    it("keeps rescheduling the flush loop after a failed flush", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("boom"));
      transport.send(makeEntry("info", "first"));
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Timer loop must still be alive — next interval should flush the next batch.
      fetchSpy.mockResolvedValueOnce({ ok: true } as Response);
      transport.send(makeEntry("info", "second"));
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("sendSingle path does not produce an unhandled rejection when fetch rejects", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("network down"));
      transport.send(makeEntry("error", "boom"));
      // Drain microtasks so the fire-and-forget sendSingle settles.
      for (let i = 0; i < 5; i++) await Promise.resolve();
      expect(unhandled).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith("auralogs: failed to send log", expect.any(Error));
    });
  });

  describe("redirect handling", () => {
    it("passes redirect: 'manual' to every fetch call (batch flush) — Workers rejects 'error'", async () => {
      transport.send(makeEntry("info", "one"));
      await transport.flush();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][1].redirect).toBe("manual");
    });

    it("passes redirect: 'manual' on the single-error fast path — Workers rejects 'error'", async () => {
      transport.send(makeEntry("error", "boom"));
      await Promise.resolve();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][1].redirect).toBe("manual");
    });

    // Behavioral test: replace the fetch spy with one that rejects unless
    // redirect: "error" is set. If a future refactor drops the option, this
    // test fails because the SDK would call fetch with the default
    // redirect: "follow" and the strict spy refuses to run.
    it("refuses to invoke a fetch that would silently follow redirects", async () => {
      const strictFetch = vi.fn(async (_url: any, init: any) => {
        if (init.redirect !== "error") {
          throw new Error(`SDK invoked fetch with redirect=${init.redirect}; expected "error"`);
        }
        return { ok: true } as Response;
      });
      const t2 = new Transport({
        apiKey: "k", endpoint: "https://x", flushInterval: 5000, maxQueueSize: 100, fetchFn: strictFetch as any,
      });
      // Batch path
      t2.send(makeEntry("info", "one"));
      await t2.flush();
      // Single-error fast path
      t2.send(makeEntry("error", "boom"));
      await Promise.resolve();
      // 1 batch fetch + 1 single-error fetch. The strict spy throws if
      // either call had `redirect !== "error"`, so reaching `.toHaveBeenCalledTimes(2)`
      // proves both code paths set the option correctly.
      expect(strictFetch).toHaveBeenCalledTimes(2);
      t2.shutdown();
    });
  });

  describe("queue cap (maxQueueSize)", () => {
    let cappedTransport: Transport;

    beforeEach(() => {
      cappedTransport = new Transport({
        apiKey: "aura_test",
        endpoint: "https://ingest.auralogs.ai",
        flushInterval: 5000,
        maxQueueSize: 3,
        fetchFn: fetchSpy,
      });
    });

    afterEach(() => { cappedTransport.shutdown(); });

    it("drops oldest entries when the buffer exceeds the cap", async () => {
      cappedTransport.send(makeEntry("info", "first"));
      cappedTransport.send(makeEntry("info", "second"));
      cappedTransport.send(makeEntry("info", "third"));
      cappedTransport.send(makeEntry("info", "fourth"));
      cappedTransport.send(makeEntry("info", "fifth"));

      await cappedTransport.flush();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.logs).toHaveLength(3);
      expect(body.logs.map((entry: { message: string }) => entry.message)).toEqual([
        "third",
        "fourth",
        "fifth",
      ]);
    });
  });
});
