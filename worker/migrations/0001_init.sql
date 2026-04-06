CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  phone     TEXT    NOT NULL UNIQUE,
  username  TEXT    NOT NULL,
  password  TEXT    NOT NULL,
  avatar    TEXT    NOT NULL DEFAULT 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
  introduc  TEXT    NOT NULL DEFAULT '',
  position  TEXT    NOT NULL DEFAULT '',
  company   TEXT    NOT NULL DEFAULT '',
  jue_power INTEGER NOT NULL DEFAULT 0,
  good_num  INTEGER NOT NULL DEFAULT 0,
  read_num  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT   NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  intro      TEXT    NOT NULL DEFAULT '',
  content    TEXT    NOT NULL DEFAULT '',
  category   TEXT    NOT NULL DEFAULT 'frontend',
  status     INTEGER NOT NULL DEFAULT 0,
  tags       TEXT    NOT NULL DEFAULT '[]',
  page_view  INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id   INTEGER NOT NULL,
  type        TEXT    NOT NULL DEFAULT 'article',
  content     TEXT    NOT NULL,
  parent_id   INTEGER,
  reply_id    INTEGER,
  target_user INTEGER,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS follows (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  fans_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, fans_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  source_id  INTEGER NOT NULL,
  type       INTEGER NOT NULL,
  status     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS praises (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id   INTEGER NOT NULL,
  target_type INTEGER NOT NULL DEFAULT 1,
  type        INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(target_id, target_type, type, created_by)
);

CREATE TABLE IF NOT EXISTS shortmsgs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  content    TEXT    NOT NULL,
  images     TEXT    NOT NULL DEFAULT '[]',
  created_by INTEGER NOT NULL REFERENCES users(id),
  group_key  TEXT    NOT NULL DEFAULT 'all',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_category   ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_created_by ON articles(created_by);
CREATE INDEX IF NOT EXISTS idx_articles_status     ON articles(status);
CREATE INDEX IF NOT EXISTS idx_comments_source_id  ON comments(source_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_by ON comments(created_by);
CREATE INDEX IF NOT EXISTS idx_follows_user_id     ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_fans_id     ON follows(fans_id);
CREATE INDEX IF NOT EXISTS idx_praises_target      ON praises(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_praises_created_by  ON praises(created_by);
CREATE INDEX IF NOT EXISTS idx_messages_user_id    ON messages(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shortmsgs_group_key ON shortmsgs(group_key);
CREATE INDEX IF NOT EXISTS idx_shortmsgs_created_by ON shortmsgs(created_by);
