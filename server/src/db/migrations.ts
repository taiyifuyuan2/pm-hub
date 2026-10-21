import type { DatabaseSync } from "node:sqlite";

/**
 * スキーマのマイグレーション。PRAGMA user_version に適用済みバージョンを記録する。
 * 既存の要素は書き換えず、変更は必ず新しいバージョンとして末尾に追加すること。
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE tasks (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL CHECK (status IN ('unread', 'active', 'scheduled', 'done')),
        category    TEXT NOT NULL,
        createdAt   TEXT NOT NULL,
        scheduledAt TEXT
      );

      CREATE TABLE memos (
        taskId    TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
        content   TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      -- Claude Code の --resume 用。タスクごとに1セッション
      CREATE TABLE ai_sessions (
        taskId    TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
        sessionId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      -- 表示順は挿入順（rowid）。同一ミリ秒に複数件入ることがあるため timestamp では並べない
      CREATE TABLE ai_logs (
        id        TEXT PRIMARY KEY,
        taskId    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        sender    TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
        kind      TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'tool')),
        message   TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status    TEXT CHECK (status IN ('pending', 'running', 'done', 'error'))
      );
      CREATE INDEX idx_ai_logs_task ON ai_logs(taskId);

      CREATE TABLE messages (
        id        TEXT PRIMARY KEY,
        taskId    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        source    TEXT NOT NULL CHECK (source IN ('slack', 'email', 'beeper')),
        sender    TEXT NOT NULL,
        content   TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX idx_messages_task ON messages(taskId);
    `,
  },
  {
    // 許可確認のログ（kind = permission）と、その付加情報 detail（JSON）を追加。
    // SQLite は CHECK 制約を変更できないため、テーブルを作り直して rowid（表示順）ごと移す
    version: 2,
    sql: `
      CREATE TABLE ai_logs_v2 (
        id        TEXT PRIMARY KEY,
        taskId    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        sender    TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
        kind      TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'tool', 'permission')),
        message   TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status    TEXT CHECK (status IN ('pending', 'running', 'done', 'error')),
        detail    TEXT
      );
      INSERT INTO ai_logs_v2 (rowid, id, taskId, sender, kind, message, timestamp, status)
        SELECT rowid, id, taskId, sender, kind, message, timestamp, status FROM ai_logs;
      DROP TABLE ai_logs;
      ALTER TABLE ai_logs_v2 RENAME TO ai_logs;
      CREATE INDEX idx_ai_logs_task ON ai_logs(taskId);
    `,
  },
  {
    // 「このセッションでは常に許可」のルール。会話（ai_sessions）をリセットしたら一緒に消す
    version: 3,
    sql: `
      CREATE TABLE permission_rules (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        toolName  TEXT NOT NULL,
        pattern   TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        UNIQUE (taskId, toolName, pattern)
      );
    `,
  },
  {
    // タスクのピン留め
    version: 4,
    sql: `ALTER TABLE tasks ADD COLUMN isPinned INTEGER NOT NULL DEFAULT 0 CHECK (isPinned IN (0, 1));`,
  },
  {
    // メッセージの送信元に line（LINE）と manual（手入力）を追加。CHECK 制約の変更のため作り直す
    version: 5,
    sql: `
      CREATE TABLE messages_v5 (
        id        TEXT PRIMARY KEY,
        taskId    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        source    TEXT NOT NULL CHECK (source IN ('slack', 'email', 'beeper', 'line', 'manual')),
        sender    TEXT NOT NULL,
        content   TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      INSERT INTO messages_v5 (rowid, id, taskId, source, sender, content, timestamp)
        SELECT rowid, id, taskId, source, sender, content, timestamp FROM messages;
      DROP TABLE messages;
      ALTER TABLE messages_v5 RENAME TO messages;
      CREATE INDEX idx_messages_task ON messages(taskId);
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** 未適用のマイグレーションを順に適用し、適用前のバージョンを返す */
export function migrate(db: DatabaseSync): number {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (current > LATEST_VERSION) {
    throw new Error(`DB のバージョン(${current})がアプリ(${LATEST_VERSION})より新しいため開けません`);
  }

  for (const { version, sql } of MIGRATIONS) {
    if (version <= current) continue;
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec("COMMIT");
      console.log(`[db] migrated to v${version}`);
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return current;
}
