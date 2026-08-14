// Cloudflare Workers type declarations for the API/worker code
// We don't include @cloudflare/workers-types globally because it conflicts with DOM types

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T = unknown>(col?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

declare interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1ExecResult>;
  dump(): Promise<ArrayBuffer>;
}

declare interface D1ExecResult {
  count: number;
  duration: number;
}

declare interface ScheduledController {
  scheduledTime: number;
  cron: string;
  noRetry(): void;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
