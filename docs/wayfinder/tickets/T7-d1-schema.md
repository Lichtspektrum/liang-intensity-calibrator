# T7: D1 数据库 schema 设计

**类型**: implemented
**状态**: done
**依赖**: T3（打分算法精确公式）
**阻塞**: T11（API 契约）

## Current Schema

当前 D1 schema 来自：

- `migrations/0001_init.sql`
- `migrations/0002_add_vote_position.sql`

```sql
CREATE TABLE IF NOT EXISTS daily_votes (
  date TEXT PRIMARY KEY,
  up_count INTEGER NOT NULL DEFAULT 0,
  down_count INTEGER NOT NULL DEFAULT 0,
  unique_voters INTEGER NOT NULL DEFAULT 0,
  news_delta REAL NOT NULL DEFAULT 0,
  final_score REAL
);

CREATE TABLE IF NOT EXISTS votes (
  fingerprint TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  date TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('up', 'down')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  position REAL,
  PRIMARY KEY (fingerprint, date)
);
CREATE INDEX IF NOT EXISTS idx_votes_ip_date ON votes(ip_hash, date);

CREATE TABLE IF NOT EXISTS news_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  polarity REAL NOT NULL,
  impact REAL NOT NULL,
  source_urls TEXT NOT NULL,
  sources TEXT NOT NULL,
  heat REAL DEFAULT 0,
  is_major INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON news_events(date);

CREATE TABLE IF NOT EXISTS score_snapshots (
  date TEXT PRIMARY KEY,
  score REAL NOT NULL,
  level REAL NOT NULL,
  stage TEXT NOT NULL,
  up_count INTEGER NOT NULL,
  down_count INTEGER NOT NULL,
  major_event_id INTEGER,
  FOREIGN KEY (major_event_id) REFERENCES news_events(id)
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## Semantics

- `votes` is the authoritative table for same-day voter records. `fingerprint + date` is unique, so same-day revotes are implemented with upsert.
- `position` stores the user's integer vote position in the `0-30` range.
- `direction` is derived from `position`: `position >= 15` is `up`, otherwise `down`.
- `score_snapshots` is the timeline data source and is written by the hourly scheduled task.
- `news_events` stores AI-analyzed or keyword-fallback news events.
- `daily_votes` currently exists but is not the primary read/write path for score calculation.

## KV Companion State

- `score_state`: current score state.
- `vote:ip:<date>:<ip_hash>`: per-IP daily new-voter count, TTL 48 hours.
- `news:url:<hash>`: processed news URL marker, TTL 7 days.

## Notes

- `ip_hash` is SHA-256 over `liang-slider-ip:<ip>`.
- Old documentation used final score 0-100; current D1 values are 0-30.
