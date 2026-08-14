CREATE TABLE news_calibrations (
  date TEXT NOT NULL PRIMARY KEY,
  payload TEXT NOT NULL,
  collected_at INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_news_calibrations_collected_at
  ON news_calibrations(collected_at);

CREATE TABLE ai_request_limits (
  ip_hash TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count >= 0),
  PRIMARY KEY (ip_hash, hour_bucket)
) STRICT;
