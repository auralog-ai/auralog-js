import { describe, it, expect, vi, afterEach } from "vitest";
import { init, auralog, shutdown } from "../src/index.js";

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
});
