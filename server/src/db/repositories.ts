import { randomUUID } from "node:crypto";
import type { AiLog, Memo, MessageThread, Suggestion, Task, WatchedChat } from "../../../shared/types";
import { ALLOW_ALL_TOOL, type RuleSpec } from "../agent/permissionRules";
import { db } from "./database";

const now = () => new Date().toISOString();

// node:sqlite は NULL を null で返すので、省略可能プロパティは undefined に揃える
type Row = Record<string, unknown>;
const opt = <T>(value: unknown) => (value === null ? undefined : (value as T));

const groupByTask = <T extends { taskId: string }>(items: T[]) =>
  items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.taskId] ??= []).push(item);
    return acc;
  }, {});

// ---------- tasks ----------

const toTask = (r: Row): Task => ({
  id: r.id as string,
  title: r.title as string,
  description: r.description as string,
  status: r.status as Task["status"],
  category: r.category as string,
  createdAt: r.createdAt as string,
  scheduledAt: opt(r.scheduledAt),
  isPinned: r.isPinned === 1,
});

const selectTasks = db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC");
const selectTask = db.prepare("SELECT * FROM tasks WHERE id = ?");
const insertTask = db.prepare(
  `INSERT INTO tasks (id, title, description, status, category, createdAt, scheduledAt, isPinned)
   VALUES ($id, $title, $description, $status, $category, $createdAt, $scheduledAt, $isPinned)`,
);
// memos / ai_sessions / ai_logs / messages は ON DELETE CASCADE で一緒に消える
const deleteTaskStmt = db.prepare("DELETE FROM tasks WHERE id = ?");
const updateTaskStmt = db.prepare(
  `UPDATE tasks SET title = $title, description = $description, status = $status,
     category = $category, scheduledAt = $scheduledAt, isPinned = $isPinned
   WHERE id = $id`,
);

export const tasksRepo = {
  list: () => selectTasks.all().map(toTask),
  get: (id: string) => {
    const row = selectTask.get(id);
    return row ? toTask(row) : undefined;
  },
  insert: (task: Task) => {
    // SQLite には真偽値がないため、isPinned は 0/1 で保存する
    insertTask.run({ ...task, scheduledAt: task.scheduledAt ?? null, isPinned: task.isPinned ? 1 : 0 });
    return task;
  },
  update: (id: string, patch: Partial<Omit<Task, "id" | "createdAt">>) => {
    const current = tasksRepo.get(id);
    if (!current) return undefined;
    const next: Task = { ...current, ...patch };
    updateTaskStmt.run({
      id,
      title: next.title,
      description: next.description,
      status: next.status,
      category: next.category,
      scheduledAt: next.scheduledAt ?? null,
      isPinned: next.isPinned ? 1 : 0,
    });
    return next;
  },
  /** 削除できたら true */
  remove: (id: string) => deleteTaskStmt.run(id).changes > 0,
};

// ---------- memos ----------

const selectMemos = db.prepare("SELECT * FROM memos");
const upsertMemo = db.prepare(
  `INSERT INTO memos (taskId, content, updatedAt) VALUES (?, ?, ?)
   ON CONFLICT(taskId) DO UPDATE SET content = excluded.content, updatedAt = excluded.updatedAt`,
);

export const memosRepo = {
  all: (): Record<string, Memo> =>
    Object.fromEntries(
      selectMemos.all().map((r) => [r.taskId, { taskId: r.taskId, content: r.content, updatedAt: r.updatedAt } as Memo]),
    ),
  save: (taskId: string, content: string): Memo => {
    const memo = { taskId, content, updatedAt: now() };
    upsertMemo.run(memo.taskId, memo.content, memo.updatedAt);
    return memo;
  },
};

// ---------- ai_sessions ----------

const selectSession = db.prepare("SELECT sessionId FROM ai_sessions WHERE taskId = ?");
const upsertSession = db.prepare(
  `INSERT INTO ai_sessions (taskId, sessionId, createdAt, updatedAt) VALUES ($taskId, $sessionId, $now, $now)
   ON CONFLICT(taskId) DO UPDATE SET sessionId = excluded.sessionId, updatedAt = excluded.updatedAt`,
);
const deleteSession = db.prepare("DELETE FROM ai_sessions WHERE taskId = ?");

export const sessionsRepo = {
  get: (taskId: string) => selectSession.get(taskId)?.sessionId as string | undefined,
  save: (taskId: string, sessionId: string) => upsertSession.run({ taskId, sessionId, now: now() }),
  remove: (taskId: string) => deleteSession.run(taskId),
};

// ---------- permission_rules ----------

const selectRules = db.prepare("SELECT toolName, pattern FROM permission_rules WHERE taskId = ? ORDER BY id");
// 一覧表示用。タスクが消えたルールは外部キーの連動削除で残らないが、念のため LEFT JOIN にしておく
const selectRulesDetailed = db.prepare(
  `SELECT r.id, r.taskId, COALESCE(t.title, '') AS taskTitle, r.toolName, r.pattern, r.createdAt
   FROM permission_rules r LEFT JOIN tasks t ON t.id = r.taskId
   WHERE ($taskId IS NULL OR r.taskId = $taskId)
   ORDER BY r.id`,
);
const deleteRuleById = db.prepare("DELETE FROM permission_rules WHERE id = ?");
const deleteAllRules = db.prepare("DELETE FROM permission_rules");
const deleteAllowAll = db.prepare("DELETE FROM permission_rules WHERE taskId = ? AND toolName = ?");
const insertRule = db.prepare(
  "INSERT OR IGNORE INTO permission_rules (taskId, toolName, pattern, createdAt) VALUES (?, ?, ?, ?)",
);
const deleteRules = db.prepare("DELETE FROM permission_rules WHERE taskId = ?");

export const rulesRepo = {
  list: (taskId: string): RuleSpec[] =>
    selectRules.all(taskId).map((r) => ({ toolName: r.toolName as string, pattern: r.pattern as string })),
  /** 画面表示用の一覧。taskId を渡すとそのタスクだけに絞る */
  listDetailed: (taskId?: string) =>
    selectRulesDetailed.all({ taskId: taskId ?? null }).map((r) => ({
      id: r.id as number,
      taskId: r.taskId as string,
      taskTitle: r.taskTitle as string,
      toolName: r.toolName as string,
      pattern: r.pattern as string,
      createdAt: r.createdAt as string,
    })),
  /** 1件だけ解除する。削除できたら true */
  removeById: (id: number) => deleteRuleById.run(id).changes > 0,
  /** 全タスクのルールをすべて解除する。削除した件数を返す */
  clearAll: () => Number(deleteAllRules.run().changes),
  add: (taskId: string, rule: RuleSpec) => insertRule.run(taskId, rule.toolName, rule.pattern, now()),
  /** 「このセッション中すべて許可」のオン・オフ。全ツールに合致するルール（toolName = "*"）として保存する */
  setAllowAll: (taskId: string, enabled: boolean) => {
    if (enabled) insertRule.run(taskId, ALLOW_ALL_TOOL, "", now());
    else deleteAllowAll.run(taskId, ALLOW_ALL_TOOL);
  },
  /** 会話のリセット時や、ユーザーによる解除で呼ぶ */
  clear: (taskId: string) => deleteRules.run(taskId),
};

// ---------- ai_logs ----------

const selectLogs = db.prepare("SELECT * FROM ai_logs ORDER BY rowid");
const insertLog = db.prepare(
  `INSERT INTO ai_logs (id, taskId, sender, kind, message, timestamp, status, detail)
   VALUES ($id, $taskId, $sender, $kind, $message, $timestamp, $status, $detail)`,
);

export const aiLogsRepo = {
  allByTask: () =>
    groupByTask(
      selectLogs.all().map(
        (r): AiLog => ({
          id: r.id as string,
          taskId: r.taskId as string,
          sender: r.sender as AiLog["sender"],
          kind: r.kind as AiLog["kind"],
          message: r.message as string,
          timestamp: r.timestamp as string,
          status: opt(r.status),
          // detail には kind = permission のときだけ PermissionInfo の JSON が入る
          permission: r.detail ? (JSON.parse(r.detail as string) as AiLog["permission"]) : undefined,
        }),
      ),
    ),
  insert: (log: Omit<AiLog, "id" | "timestamp">) => {
    insertLog.run({
      id: randomUUID(),
      timestamp: now(),
      taskId: log.taskId,
      sender: log.sender,
      kind: log.kind ?? "text",
      message: log.message,
      status: log.status ?? null,
      detail: log.permission ? JSON.stringify(log.permission) : null,
    });
  },
};

// ---------- messages ----------

const selectMessages = db.prepare("SELECT * FROM messages ORDER BY timestamp, rowid");
const insertMessage = db.prepare(
  "INSERT INTO messages (id, taskId, source, sender, content, timestamp) VALUES (:id, :taskId, :source, :sender, :content, :timestamp)",
);
const deleteMessage = db.prepare("DELETE FROM messages WHERE taskId = ? AND id = ?");

export const messagesRepo = {
  allByTask: () => groupByTask(selectMessages.all() as unknown as MessageThread[]),
  insert: (m: Omit<MessageThread, "id" | "timestamp"> & { timestamp?: string }): MessageThread => {
    const row = { ...m, id: randomUUID(), timestamp: m.timestamp ?? now() };
    insertMessage.run(row);
    return row;
  },
  remove: (taskId: string, id: string) =>
    Number(deleteMessage.run(taskId, id).changes) > 0,
};

// ---------- 受信トレイ ----------

const selectWatched = db.prepare("SELECT * FROM watched_chats ORDER BY createdAt");
const upsertWatched = db.prepare(
  `INSERT INTO watched_chats (chatID, title, network, lastSeen, createdAt) VALUES ($chatID, $title, $network, $lastSeen, $createdAt)
   ON CONFLICT(chatID) DO UPDATE SET title = excluded.title, network = excluded.network`,
);
const deleteWatched = db.prepare("DELETE FROM watched_chats WHERE chatID = ?");
const updateLastSeen = db.prepare("UPDATE watched_chats SET lastSeen = ? WHERE chatID = ?");

export const watchRepo = {
  list: () => selectWatched.all() as unknown as (WatchedChat & { lastSeen: string })[],
  add: (chat: WatchedChat) => upsertWatched.run({ ...chat, lastSeen: now(), createdAt: now() }),
  remove: (chatID: string) => deleteWatched.run(chatID),
  setLastSeen: (chatID: string, lastSeen: string) => updateLastSeen.run(lastSeen, chatID),
};

const toSuggestion = (r: Row): Suggestion => ({
  id: r.id as string,
  chatID: r.chatID as string,
  chatTitle: r.chatTitle as string,
  network: r.network as string,
  incoming: r.incoming as string,
  incomingAt: r.incomingAt as string,
  draft: r.draft as string,
  note: opt(r.note),
  status: r.status as Suggestion["status"],
  error: opt(r.error),
  createdAt: r.createdAt as string,
  updatedAt: r.updatedAt as string,
});

// 対応が必要なもの（作成中・確認待ち・失敗）と、最近の送信済み・破棄済みだけを返す
const selectSuggestions = db.prepare(
  `SELECT * FROM suggestions
   WHERE status IN ('generating', 'pending', 'error')
      OR (status IN ('sent', 'dismissed') AND updatedAt > $since)
   ORDER BY createdAt DESC LIMIT 100`,
);
const selectSuggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?");
const insertSuggestion = db.prepare(
  `INSERT INTO suggestions (id, chatID, chatTitle, network, incoming, incomingAt, draft, status, createdAt, updatedAt)
   VALUES ($id, $chatID, $chatTitle, $network, $incoming, $incomingAt, '', 'generating', $now, $now)`,
);
const supersedeSuggestions = db.prepare(
  "UPDATE suggestions SET status = 'dismissed', updatedAt = $now WHERE chatID = $chatID AND status IN ('generating', 'pending', 'error')",
);
const updateSuggestionStmt = db.prepare(
  `UPDATE suggestions SET draft = $draft, note = $note, status = $status, error = $error, updatedAt = $now WHERE id = $id`,
);
const failInterrupted = db.prepare(
  "UPDATE suggestions SET status = 'error', error = '中断されました（再生成してください）', updatedAt = $now WHERE status = 'generating'",
);

export const suggestionsRepo = {
  list: (): Suggestion[] =>
    selectSuggestions.all({ since: new Date(Date.now() - 24 * 3600_000).toISOString() }).map(toSuggestion),
  get: (id: string) => {
    const row = selectSuggestion.get(id);
    return row ? toSuggestion(row) : undefined;
  },
  /** 同じチャットの未対応の案は、新しい案で置き換える */
  create: (input: { chatID: string; chatTitle: string; network: string; incoming: string; incomingAt: string }) => {
    const id = randomUUID();
    supersedeSuggestions.run({ chatID: input.chatID, now: now() });
    insertSuggestion.run({ ...input, id, now: now() });
    return suggestionsRepo.get(id)!;
  },
  update: (id: string, patch: Partial<Pick<Suggestion, "draft" | "note" | "status" | "error">>) => {
    const cur = suggestionsRepo.get(id);
    if (!cur) return undefined;
    const next = { ...cur, ...patch };
    updateSuggestionStmt.run({
      id,
      draft: next.draft,
      note: next.note ?? null,
      status: next.status,
      error: next.error ?? null,
      now: now(),
    });
    return suggestionsRepo.get(id);
  },
  failInterrupted: () => failInterrupted.run({ now: now() }),
};

const selectSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const upsertSetting = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
);

export const settingsRepo = {
  get: (key: string) => selectSetting.get(key)?.value as string | undefined,
  set: (key: string, value: string) => upsertSetting.run(key, value),
};
