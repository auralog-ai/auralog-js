import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { init, auralog, shutdown } from "../src/index.js";

/**
 * Covers the eight required cases from spec 2026-04-25-global-metadata.md.
 * Tests run end-to-end through `init()` so they exercise the same wiring a
 * host application sees: Logger -> MetadataMerger -> Transport.
 */
describe("globalMetadata", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await shutdown();
    warnSpy.mockRestore();
  });

  function lastSentLogs(): Array<Record<string, unknown>> {
    const calls = fetchSpy.mock.calls;
    if (calls.length === 0) return [];
    const body = JSON.parse(calls[calls.length - 1][1].body);
    if (body.logs) return body.logs;
    if (body.log) return [body.log];
    return [];
  }

  it("static map form attaches to every entry", async () => {
    const { flush } = init(
      {
        apiKey: "k",
        endpoint: "https://test",
        captureConsole: false,
        captureErrors: false,
        globalMetadata: { user_id: "u-1", env_kind: "prod" },
      },
      fetchSpy,
    );

    auralog.info("first");
    auralog.info("second");
    await flush();

    const logs = lastSentLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].metadata).toEqual({ user_id: "u-1", env_kind: "prod" });
    expect(logs[1].metadata).toEqual({ user_id: "u-1", env_kind: "prod" });
  });

  it("supplier form is invoked on every emission", async () => {
    const supplier = vi.fn(() => ({ user_id: "u-2" }));
    const { flush } = init(
      {
        apiKey: "k",
        endpoint: "https://test",
        captureConsole: false,
        captureErrors: false,
        globalMetadata: supplier,
      },
      fetchSpy,
    );

    auralog.info("a");
    auralog.info("b");
    auralog.info("c");
    await flush();

    expect(supplier).toHaveBeenCalledTimes(3);
    expect(supplier.mock.calls.length).toBeGreaterThan(1);
  });

  it("supplier that throws emits entry without globalMetadata and warns once", async () => {
    const supplier = vi.fn(() => {
      throw new Error("supplier boom");
    });
    const { flush } = init(
      {
        apiKey: "k",
        endpoint: "https://test",
        captureConsole: false,
        captureErrors: false,
        globalMetadata: supplier,
      },
      fetchSpy,
    );

    auralog.info("first", { request_id: "r-1" });
    auralog.info("second", { request_id: "r-2" });
    auralog.info("third");
    await flush();

    const logs = lastSentLogs();
    expect(logs).toHaveLength(3);
    // Per-call metadata still flows through; globalMetadata is dropped.
    expect(logs[0].metadata).toEqual({ request_id: "r-1" });
    expect(logs[1].metadata).toEqual({ request_id: "r-2" });
    // Third entry had no per-call metadata: omit field entirely.
    expect(logs[2]).not.toHaveProperty("metadata");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("globalMetadata");
  });

  it("supplier that returns a thenable emits entry without globalMetadata and warns once", async () => {
    const supplier = () => Promise.resolve({ user_id: "u-async" });
    const { flush } = init(
      {
        apiKey: "k",
        endpoint: "https://test",
        captureConsole: false,
        captureErrors: false,
        globalMetadata: supplier,
      },
      fetchSpy,
    );

    auralog.info("hello");
    auralog.info("world");
    await flush();

    const logs = lastSentLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0]).not.toHaveProperty("metadata");
    expect(logs[1]).not.toHaveProperty("metadata");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("thenable");
  });

  it("per-call key overrides a globalMetadata key on collision (shallow)", async () => {
    const { flush } = init(
      {
        apiKey: "k",
        endpoint: "https://test",
        captureConsole: false,
        captureErrors: false,
        globalMetadata: { user_id: "global-user", role: "admin" },
      },
      fetchSpy,
    );

    auralog.info("override", { user_id: "specific-user", request_id: "r-9" });
    await flush();

    const logs = lastSentLogs();
    expect(logs[0].metadata).toEqual({
      user_id: "specific-user",
      role: "admin",
      request_id: "r-9",
    });
  });

  it("captureConsole-produced entries carry globalMetadata", async () => {
    const { flush } = init(
      {
        apiKey: "k",
        endpoint: "https://test",
        captureConsole: true,
        captureErrors: false,
        globalMetadata: () => ({ user_id: "u-supplier" }),
      },
      fetchSpy,
    );

    console.log("captured via console.log");
    await flush();

    const logs = lastSentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("info");
    expect(logs[0].message).toBe("captured via console.log");
    expect(logs[0].metadata).toEqual({ user_id: "u-supplier" });
  });

  it("captureErrors-produced entries carry globalMetadata", async () => {
    init(
      {
        apiKey: "k",
        endpoint: "https://test",
        captureConsole: false,
        captureErrors: true,
        globalMetadata: { user_id: "u-on-crash" },
      },
      fetchSpy,
    );

    process.emit("unhandledRejection", new Error("oops"), Promise.resolve());

    // sendSingle is fire-and-forget; drain microtasks.
    for (let drain = 0; drain < 5; drain += 1) await Promise.resolve();

    const logs = lastSentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].metadata).toEqual({ user_id: "u-on-crash" });
  });

  it("non-serializable merged metadata drops globalMetadata, ships entry, warns once", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const { flush } = init(
      {
        apiKey: "k",
        endpoint: "https://test",
        captureConsole: false,
        captureErrors: false,
        globalMetadata: () => ({ user_id: "u-x", loop: circular }),
      },
      fetchSpy,
    );

    auralog.info("survives", { request_id: "r-1" });
    auralog.info("also survives");
    await flush();

    const logs = lastSentLogs();
    expect(logs).toHaveLength(2);
    // Per-call survives, global is dropped.
    expect(logs[0].metadata).toEqual({ request_id: "r-1" });
    expect(logs[1]).not.toHaveProperty("metadata");

    // Both calls hit the failure path but warning only fires once.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("non-JSON-serializable");
  });

  it("absent globalMetadata leaves wire payload unchanged (no metadata field)", async () => {
    const { flush } = init(
      { apiKey: "k", endpoint: "https://test", captureConsole: false, captureErrors: false },
      fetchSpy,
    );

    auralog.info("plain");
    await flush();

    const logs = lastSentLogs();
    expect(logs[0]).not.toHaveProperty("metadata");
  });
});
