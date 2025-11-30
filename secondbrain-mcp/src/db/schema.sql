CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('note', 'research', 'survey', 'idea', 'decision', 'backlog', 'learning')),
  source TEXT,
  tags TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_source ON memories(source);
CREATE INDEX idx_memories_created_at ON memories(created_at);

CREATE TABLE IF NOT EXISTS memory_vectors (
  memory_id INTEGER PRIMARY KEY,
  vector_id TEXT NOT NULL UNIQUE,
  embedding_model TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);
