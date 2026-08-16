CREATE TABLE pricing_signal_records (
  hour_bucket TEXT NOT NULL PRIMARY KEY,
  flash_cost REAL NOT NULL,
  pro_cost REAL NOT NULL,
  flash_ratio REAL NOT NULL,
  pro_ratio REAL NOT NULL,
  cost_streak INTEGER NOT NULL DEFAULT 0,
  recorded_at INTEGER NOT NULL
) STRICT;