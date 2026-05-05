import { isAtOrAboveLevel } from "./types.js";
import type { InternalLogEntry } from "./types.js";

interface TransportConfig {
  apiKey: string;
  endpoint: string;
  flushInterval: number;
  maxQueueSize: number;
  fetchFn?: typeof fetch;
}

export class Transport {
  private apiKey: string;
  private endpoint: string;
  private flushInterval: number;
  private maxQueueSize: number;
  private buffer: InternalLogEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fetchFn: typeof fetch;
  private stopped = false;

  constructor(config: TransportConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.flushInterval = config.flushInterval;
    this.maxQueueSize = config.maxQueueSize;
    this.fetchFn = config.fetchFn ?? fetch.bind(globalThis);
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      // Fire-and-forget: reschedule only after flush completes so runAllTimersAsync
      // sees an empty timer queue and can resolve between the fire and the reschedule.
      void this.flush().then(() => this.scheduleNext());
    }, this.flushInterval);
  }

  send(entry: InternalLogEntry): void {
    if (isAtOrAboveLevel(entry.level, "error")) { void this.sendSingle(entry); return; }
    this.buffer.push(entry);
    // Drop oldest entries if we'd exceed the cap. An unreachable ingest endpoint
    // must not be allowed to OOM the host application.
    if (this.buffer.length > this.maxQueueSize) {
      this.buffer.splice(0, this.buffer.length - this.maxQueueSize);
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const logs = this.buffer.splice(0);
    try {
      await this.fetchFn(`${this.endpoint}/v1/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectApiKey: this.apiKey, logs }),
        // Refuse to follow redirects. fetch's default `redirect: "follow"`
        // re-sends the request body (which contains projectApiKey) to whatever
        // host the Location header points at — a hostile or compromised
        // intermediate, or a server-side bug, would exfiltrate keys fleet-wide.
        redirect: "error",
      });
    } catch (err) {
      // Swallow so a single network failure does not kill the reschedule loop
      // in scheduleNext() or surface as an unhandled rejection in the host app.
      console.warn("auralog: failed to send logs", err);
    }
  }

  shutdown(): void {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private async sendSingle(entry: InternalLogEntry): Promise<void> {
    try {
      await this.fetchFn(`${this.endpoint}/v1/logs/single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectApiKey: this.apiKey, log: entry }),
        // See flush() for rationale — never replay the body to a redirect target.
        redirect: "error",
      });
    } catch (err) {
      // send() dispatches this as `void sendSingle(...)`, so an uncaught reject
      // would become an unhandled promise rejection in the host app.
      console.warn("auralog: failed to send log", err);
    }
  }
}
