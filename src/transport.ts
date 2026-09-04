import { isAtOrAboveLevel } from "./types.js";
import type { InternalLogEntry } from "./types.js";

interface TransportConfig {
  apiKey: string;
  endpoint: string;
  flushInterval: number;
  maxQueueSize: number;
  fetchFn?: typeof fetch;
}

// Never follow redirects: fetch's default `redirect: "follow"` re-sends the
// request body (which contains projectApiKey) to whatever host the Location
// header points at — a hostile or compromised intermediate, or a server-side
// bug, would exfiltrate keys fleet-wide.
//
// We use "manual", not "error". Cloudflare Workers' fetch rejects
// `redirect: "error"` outright ("Invalid redirect value, must be one of
// follow or manual"), so with "error" every send from a Worker threw, was
// swallowed by the catch in flush()/sendSingle(), and the log was silently
// lost. With "manual" a redirect comes back as a 3xx (or an opaque-redirect
// response in browsers); checkResponse() refuses it without replaying the body.
const REDIRECT_MODE = "manual" as const;

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
      const res = await this.fetchFn(`${this.endpoint}/v1/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectApiKey: this.apiKey, logs }),
        redirect: REDIRECT_MODE,
      });
      this.checkResponse(res, "logs");
    } catch (err) {
      // Swallow so a single network failure does not kill the reschedule loop
      // in scheduleNext() or surface as an unhandled rejection in the host app.
      console.warn("auralogs: failed to send logs", err);
    }
  }

  // Surface delivery failures that fetch does not reject on. A redirect is
  // refused (the body is never re-sent, see REDIRECT_MODE); any other non-2xx
  // is reported so a bad key or exhausted quota is visible instead of silently
  // dropping logs. Tolerates minimal Response-like objects (tests, polyfills).
  private checkResponse(res: Response | undefined, what: string): void {
    if (!res) return;
    const status = typeof res.status === "number" ? res.status : 200;
    const isRedirect = res.type === "opaqueredirect" || (status >= 300 && status < 400);
    if (isRedirect) {
      console.warn(`auralogs: refused to follow a redirect while sending ${what} (status ${status}); the request body was not re-sent`);
      return;
    }
    if (res.ok === false || status >= 400) {
      console.warn(`auralogs: ingest responded ${status} while sending ${what}`);
    }
  }

  shutdown(): void {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private async sendSingle(entry: InternalLogEntry): Promise<void> {
    try {
      const res = await this.fetchFn(`${this.endpoint}/v1/logs/single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectApiKey: this.apiKey, log: entry }),
        redirect: REDIRECT_MODE,
      });
      this.checkResponse(res, "log");
    } catch (err) {
      // send() dispatches this as `void sendSingle(...)`, so an uncaught reject
      // would become an unhandled promise rejection in the host app.
      console.warn("auralogs: failed to send log", err);
    }
  }
}
