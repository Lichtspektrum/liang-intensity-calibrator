CREATE TABLE voters (
  voter_hash TEXT NOT NULL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN -15 AND 15),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_voters_ip_created_at ON voters(ip_hash, created_at);

CREATE TABLE daily_snapshots (
  date TEXT NOT NULL PRIMARY KEY,
  score REAL NOT NULL CHECK(score BETWEEN -15 AND 15),
  voter_count INTEGER NOT NULL CHECK(voter_count >= 0),
  created_at INTEGER NOT NULL
) STRICT;
