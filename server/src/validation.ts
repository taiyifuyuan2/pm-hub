import type { MessageSource, Task, TaskStatus } from "../../shared/types";

// taskId は作業ディレクトリ名にも使うので、パス区切りなどを含まない値に限定する
export const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const isTaskId = (v: unknown): v is string => typeof v === "string" && TASK_ID_PATTERN.test(v);

const STATUSES: readonly TaskStatus[] = ["unread", "active", "scheduled", "done"];
const MAX_TEXT = 20_000;

const isText = (v: unknown, max = MAX_TEXT): v is string => typeof v === "string" && v.length <= max;
const isIsoDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

export type TaskPatch = Partial<Omit<Task, "id" | "createdAt">>;

/** PATCH /api/tasks/:id の本文を検証する。不正なら理由の文字列を返す */
export function parseTaskPatch(body: unknown): TaskPatch | string {
  if (typeof body !== "object" || body === null) return "本文が不正です";
  const b = body as Record<string, unknown>;
  const patch: TaskPatch = {};

  if ("title" in b) {
    if (!isText(b.title, 500) || !b.title.trim()) return "title が不正です";
    patch.title = b.title.trim();
  }
  if ("description" in b) {
    if (!isText(b.description)) return "description が不正です";
    patch.description = b.description;
  }
  if ("category" in b) {
    if (!isText(b.category, 100) || !b.category.trim()) return "category が不正です";
    patch.category = b.category.trim();
  }
  if ("isPinned" in b) {
    if (typeof b.isPinned !== "boolean") return "isPinned が不正です";
    patch.isPinned = b.isPinned;
  }
  if ("status" in b) {
    if (!STATUSES.includes(b.status as TaskStatus)) return "status が不正です";
    patch.status = b.status as TaskStatus;
  }
  if ("scheduledAt" in b) {
    // null で予定日時を解除できる
    if (b.scheduledAt !== null && !isIsoDate(b.scheduledAt)) return "scheduledAt が不正です";
    patch.scheduledAt = (b.scheduledAt as string | null) ?? undefined;
  }
  return patch;
}

/** POST /api/tasks の本文を検証する。id はクライアント生成（楽観的更新のため） */
export function parseNewTask(body: unknown): Task | string {
  if (typeof body !== "object" || body === null) return "本文が不正です";
  const b = body as Record<string, unknown>;
  if (!isTaskId(b.id)) return "id が不正です";
  const rest = parseTaskPatch({ description: "", ...b });
  if (typeof rest === "string") return rest;
  if (!rest.title || !rest.category || !rest.status) return "title / category / status は必須です";

  return {
    id: b.id,
    title: rest.title,
    description: rest.description ?? "",
    category: rest.category,
    status: rest.status,
    createdAt: isIsoDate(b.createdAt) ? b.createdAt : new Date().toISOString(),
    scheduledAt: rest.scheduledAt,
    isPinned: rest.isPinned ?? false,
  };
}

const MESSAGE_SOURCES: readonly MessageSource[] = ["slack", "email", "beeper", "line", "manual"];

/** POST /api/tasks/:id/messages の本文を検証する。不正なら理由の文字列を返す */
export function parseNewMessage(body: unknown): { source: MessageSource; sender: string; content: string } | string {
  if (typeof body !== "object" || body === null) return "本文が不正です";
  const b = body as Record<string, unknown>;
  const source = (b.source ?? "manual") as MessageSource;
  if (!MESSAGE_SOURCES.includes(source)) return "source が不正です";
  if (!isText(b.sender, 200) || !b.sender.trim()) return "sender が不正です";
  if (!isText(b.content) || !b.content.trim()) return "content が不正です";
  return { source, sender: b.sender.trim(), content: b.content.trim() };
}

export const isMemoContent = (v: unknown): v is string => isText(v, 200_000);
