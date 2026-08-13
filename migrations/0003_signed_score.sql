DROP TABLE IF EXISTS votes;

CREATE TABLE votes (
  fingerprint TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  date TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN -15 AND 15),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (fingerprint, date)
);

CREATE INDEX idx_votes_ip_date ON votes(ip_hash, date);

DROP TABLE IF EXISTS score_snapshots;

CREATE TABLE score_snapshots (
  date TEXT PRIMARY KEY,
  score REAL NOT NULL CHECK(score BETWEEN -15 AND 15),
  stage TEXT NOT NULL,
  positive_count INTEGER NOT NULL,
  negative_count INTEGER NOT NULL,
  neutral_count INTEGER NOT NULL,
  major_event_id INTEGER,
  FOREIGN KEY (major_event_id) REFERENCES news_events(id)
);
