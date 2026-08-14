CREATE TABLE chat_conversations (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE chat_messages (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  score REAL CHECK(score IS NULL OR (score BETWEEN -15 AND 15)),
  stage TEXT,
  calibration_summary TEXT,
  dimensions_json TEXT,
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id, id);
