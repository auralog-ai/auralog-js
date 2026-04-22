import { describe, it, expect, vi, afterEach } from "vitest";
import { init, auralog, shutdown, getTraceId, setTraceId } from "../src/index.js";

describe("init + auralog public API", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  afterEach(() => { shutdown(); vi.useRealTimers(); });

  it("exposes log methods after init", () => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    init({ apiKey: "aura_test", endpoint: "https://test.auralog.dev", captureConsole: false, captureErrors: false }, fetchSpy);
    expect(typeof auralog.info).toBe("function");
    expect(typeof auralog.error).toBe("function");
    expect(typeof auralog.debug).toBe("function");
    expect(typeof auralog.warn).toBe("function");
    expect(typeof auralog.fatal).toBe("function");
  });

  it("sends logs through transport on flush", async () => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    const { flush } = init({ apiKey: "aura_test", endpoint: "https://test.auralog.dev", captureConsole: false, captureErrors: false }, fetchSpy);
    auralog.info("hello", { key: "val" });
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.logs[0].message).toBe("hello");
    expect(body.projectApiKey).toBe("aura_test");
  });

  it("throws if auralog is used before init", () => {
    expect(() => auralog.info("test")).toThrow();
  });

  it("getTraceId returns a UUID after init", () => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    init({ apiKey: "aura_test", endpoint: "https://test.auralog.dev", captureConsole: false, captureErrors: false }, fetchSpy);
    const traceId = getTraceId();
    expect(typeof traceId).toBe("string");
    expect(traceId.length).toBeGreaterThan(0);
  });

  it("setTraceId changes the trace ID", () => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    init({ apiKey: "aura_test", endpoint: "https://test.auralog.dev", captureConsole: false, captureErrors: false }, fetchSpy);
    setTraceId("custom");
    expect(getTraceId()).toBe("custom");
  });

  it("getTraceId throws before init", () => {
    expect(() => getTraceId()).toThrow();
  });

  it("traceId from config is used", () => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    init({ apiKey: "aura_test", endpoint: "https://test.auralog.dev", captureConsole: false, captureErrors: false, traceId: "my-trace" }, fetchSpy);
    expect(getTraceId()).toBe("my-trace");
  });
});
