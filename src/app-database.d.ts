export {};

declare global {
  interface AppPreparedStatement {
    bind(...values: unknown[]): AppPreparedStatement;
    run(): Promise<AppDatabaseResult>;
    first<T = unknown>(column?: string): Promise<T | null>;
    all<T = unknown>(): Promise<AppDatabaseResult<T>>;
  }

  interface AppDatabaseResult<T = Record<string, unknown>> {
    results?: T[];
    success: boolean;
    meta?: { changes?: number; [key: string]: unknown };
  }

  interface AppDatabase {
    prepare(query: string): AppPreparedStatement;
    batch(statements: AppPreparedStatement[]): Promise<AppDatabaseResult[]>;
    exec(query: string): Promise<{ count: number; duration: number }>;
  }
}
