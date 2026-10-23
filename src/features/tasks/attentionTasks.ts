import type { Task } from "../../types";

export type AttentionKind = "overdue" | "unread" | "today";

export interface AttentionTask {
  task: Task;
  kind: AttentionKind;
}

const dayKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};

/** 今判断・着手すべき順に、未完了タスクを抽出する。 */
export function getAttentionTasks(tasks: Task[], now = new Date()): AttentionTask[] {
  const today = dayKey(now.toISOString());
  const nowTime = now.getTime();
  const priority: Record<AttentionKind, number> = { overdue: 0, unread: 1, today: 2 };

  return tasks
    .flatMap((task): AttentionTask[] => {
      if (task.status === "done") return [];
      const scheduled = task.scheduledAt ? new Date(task.scheduledAt) : null;
      if (scheduled && !Number.isNaN(scheduled.getTime()) && scheduled.getTime() < nowTime && dayKey(task.scheduledAt!) !== today) {
        return [{ task, kind: "overdue" }];
      }
      if (task.status === "unread") return [{ task, kind: "unread" }];
      if (task.scheduledAt && dayKey(task.scheduledAt) === today) return [{ task, kind: "today" }];
      return [];
    })
    .sort((a, b) => priority[a.kind] - priority[b.kind] || (a.task.scheduledAt ?? a.task.createdAt).localeCompare(b.task.scheduledAt ?? b.task.createdAt));
}
