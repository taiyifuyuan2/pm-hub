import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "../../types";
import { getAttentionTasks } from "./attentionTasks";

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id, title: id, description: "", category: "未分類", project: "", status: "active", isPinned: false, createdAt: "2026-10-20T09:00:00.000Z", ...patch,
});
const now = new Date("2026-10-23T03:00:00.000Z");

test("期限切れ、未読、今日予定の順に要対応を集める", () => {
  const result = getAttentionTasks([
    task("today", { scheduledAt: "2026-10-23T09:00:00.000Z" }),
    task("unread", { status: "unread" }),
    task("overdue", { scheduledAt: "2026-10-21T18:00:00.000Z" }),
    task("done", { status: "done", scheduledAt: "2026-10-21T18:00:00.000Z" }),
  ], now);
  assert.deepEqual(result.map((item) => `${item.kind}:${item.task.id}`), ["overdue:overdue", "unread:unread", "today:today"]);
});

test("今日を過ぎた予定は期限切れではなく、今日の要対応として残す", () => {
  const result = getAttentionTasks([task("morning", { scheduledAt: "2026-10-23T00:00:00.000Z" })], now);
  assert.deepEqual(result.map((item) => item.kind), ["today"]);
});
