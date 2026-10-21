import { randomUUID } from "node:crypto";
import type { AiLog, Memo, MessageThread, Task } from "../../../shared/types";
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
