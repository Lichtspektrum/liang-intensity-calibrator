import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";

class LocalStatement implements AppPreparedStatement {
  private values: SQLInputValue[] = [];

  constructor(private readonly statement: StatementSync) {}

  bind(...values: unknown[]): AppPreparedStatement {
    this.values = values as SQLInputValue[];
    return this;
  }

  async run(): Promise<AppDatabaseResult> {
    const result = this.statement.run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }

  async first<T = unknown>(column?: string): Promise<T | null> {
    const row = this.statement.get(...this.values) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T = unknown>(): Promise<AppDatabaseResult<T>> {
    return { success: true, results: this.statement.all(...this.values) as T[] };
  }
}

export class LocalDatabase implements AppDatabase {
  private readonly database: DatabaseSync;

  constructor(path: string, migrationsDirectory: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.applyMigrations(migrationsDirectory);
  }

  prepare(query: string): AppPreparedStatement {
    return new LocalStatement(this.database.prepare(query));
  }

  async batch(statements: AppPreparedStatement[]): Promise<AppDatabaseResult[]> {
    const results: AppDatabaseResult[] = [];
    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const started = performance.now();
    this.database.exec(query);
    return { count: 0, duration: performance.now() - started };
  }

  close(): void {
    this.database.close();
  }

  private applyMigrations(directory: string): void {
    this.database.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL) STRICT",
    );
    const applied = this.database.prepare("SELECT 1 FROM schema_migrations WHERE name = ?");
    const record = this.database.prepare(
      "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
    );
    for (const name of readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) {
      if (applied.get(name)) continue;
      this.database.exec("BEGIN IMMEDIATE");
      try {
        this.database.exec(readFileSync(join(directory, name), "utf8"));
        record.run(name, Date.now());
        this.database.exec("COMMIT");
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw new Error(`Failed to apply migration ${name}`, { cause: error });
      }
    }
  }
}

export function ensureDatabaseDirectory(path: string): void {
  const directory = dirname(path);
  if (!directory) throw new Error("Database path must include a directory");
}
