// @vitest-environment node

import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const schema = await readFile(
  new URL("../migrations/0001_init.sql", import.meta.url),
  "utf8",
);

let database: DatabaseSync;

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(schema);
});

afterEach(() => {
  database.close();
});

describe("initial database schema", () => {
  it("creates only the two current business tables as strict tables", () => {
    const tables = database
      .prepare(
        `SELECT name
         FROM sqlite_schema
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all() as Array<{ name: string }>;
    const tableOptions = database.prepare("PRAGMA table_list").all() as Array<{
      name: string;
      strict: number;
    }>;

    expect(tables.map(({ name }) => name)).toEqual([
      "daily_snapshots",
      "voters",
    ]);
    expect(
      tableOptions
        .filter(({ name }) => ["daily_snapshots", "voters"].includes(name))
        .map(({ name, strict }) => ({ name, strict }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ).toEqual([
      { name: "daily_snapshots", strict: 1 },
      { name: "voters", strict: 1 },
    ]);
  });

  it("indexes voter IP and creation time in that order", () => {
    const indexColumns = database
      .prepare("PRAGMA index_info('idx_voters_ip_created_at')")
      .all() as Array<{ name: string }>;

    expect(indexColumns.map(({ name }) => name)).toEqual([
      "ip_hash",
      "created_at",
    ]);
  });

  it("rejects null and duplicate voter hashes", () => {
    const insert = database.prepare(
      `INSERT INTO voters
       (voter_hash, ip_hash, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    );

    expect(() => insert.run(null, "ip-1", 0, 1, 1)).toThrow();
    insert.run("voter-1", "ip-1", 0, 1, 1);
    expect(() => insert.run("voter-1", "ip-2", 1, 2, 2)).toThrow();
  });

  it("accepts only integer voter positions in the signed score range", () => {
    const insert = database.prepare(
      `INSERT INTO voters
       (voter_hash, ip_hash, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    );

    expect(() => insert.run("fractional", "ip-1", 1.5, 1, 1)).toThrow();
    expect(() => insert.run("too-low", "ip-1", -16, 1, 1)).toThrow();
    expect(() => insert.run("too-high", "ip-1", 16, 1, 1)).toThrow();
    expect(() => insert.run("minimum", "ip-1", -15, 1, 1)).not.toThrow();
    expect(() => insert.run("maximum", "ip-1", 15, 1, 1)).not.toThrow();
  });

  it("rejects null or duplicate snapshot dates and negative voter counts", () => {
    const insert = database.prepare(
      `INSERT INTO daily_snapshots
       (date, score, voter_count, created_at)
       VALUES (?, ?, ?, ?)`,
    );

    expect(() => insert.run(null, 0, 0, 1)).toThrow();
    expect(() => insert.run("2026-08-14", 0, -1, 1)).toThrow();
    insert.run("2026-08-14", 0, 0, 1);
    expect(() => insert.run("2026-08-14", 1, 1, 2)).toThrow();
  });

  it("declares explicit non-null primary keys and score bounds", () => {
    expect(schema).toContain("voter_hash TEXT NOT NULL PRIMARY KEY");
    expect(schema).toContain("date TEXT NOT NULL PRIMARY KEY");
    expect(schema).toContain("CHECK(position BETWEEN -15 AND 15)");
    expect(schema).toContain("CHECK(score BETWEEN -15 AND 15)");
  });
});
