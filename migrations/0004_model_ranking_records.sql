CREATE TABLE model_ranking_records (
  hour_bucket TEXT NOT NULL PRIMARY KEY,
  best_rank INTEGER NOT NULL,
  best_label TEXT NOT NULL DEFAULT '',
  recorded_at INTEGER NOT NULL
) STRICT;