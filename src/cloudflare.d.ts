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

declare interface KVNamespace {
  get(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVListOptions): Promise<KVListResult>;
}

declare interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, unknown>;
}

declare interface KVListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

declare interface KVListResult {
  keys: Array<{ name: string; expiration?: number; metadata?: unknown }>;
  list_complete: boolean;
  cursor?: string;
}

declare interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

declare interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  writeHttpMetadata(headers: Headers): void;
}

declare interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

declare type R2Range =
  | { offset: number; length?: number }
  | { offset?: number; length: number }
  | { suffix: number };

declare interface R2Bucket {
  head(key: string): Promise<R2Object | null>;
  get(
    key: string,
    options?: { range?: R2Range | Headers; onlyIf?: Headers },
  ): Promise<R2ObjectBody | R2Object | null>;
}

declare interface Fetcher {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  run?: (model: string, options: Record<string, unknown>) => Promise<Record<string, unknown>>;
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
