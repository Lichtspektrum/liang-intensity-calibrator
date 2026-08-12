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
