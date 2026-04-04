import { isAtOrAboveLevel } from "./types.js";
import type { InternalLogEntry } from "./types.js";

interface TransportConfig {
  apiKey: string;
  endpoint: string;
  flushInterval: number;
  fetchFn?: typeof fetch;
}

export class Transport {
  private apiKey: string;
  private endpoint: string;
  private flushInterval: number;
  private buffer: InternalLogEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fetchFn: typeof fetch;
  private stopped = false;

  constructor(config: TransportConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.flushInterval = config.flushInterval;
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
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const logs = this.buffer.splice(0);
    await this.fetchFn(`${this.endpoint}/v1/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectApiKey: this.apiKey, logs }),
    });
  }

  shutdown(): void {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private async sendSingle(entry: InternalLogEntry): Promise<void> {
    await this.fetchFn(`${this.endpoint}/v1/logs/single`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectApiKey: this.apiKey, log: entry }),
    });
  }
}
