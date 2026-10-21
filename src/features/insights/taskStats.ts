import type { Task, TaskStatus } from "../../types";

/** 概要（インフォグラフィック）に出す数字をまとめたもの。画面の数字・グラフ・表は、すべてここから作る */
export interface TaskStats {
  total: number;
  /** ステータスごとの件数 */
  byStatus: Record<TaskStatus, number>;
  /** 完了していないタスクの数（未読 + 進行中 + 予定） */
  open: number;
  /** 完了率（0 ～ 1）。タスクがなければ 0 */
  completionRate: number;
  /** 予定日時をすぎているのに完了していないタスクの数 */
  overdue: number;
  /** 今週（直近7日間）に作成したタスクの数 */
  createdThisWeek: number;
  /** カテゴリごとの件数（多い順、同数なら名前順） */
  byCategory: { name: string; count: number }[];
  /** 直近 N 日間の、1日ごとの作成数。古い日から今日の順 */
  createdPerDay: { date: Date; count: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const DAILY_WINDOW_DAYS = 14;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function computeTaskStats(tasks: Task[], now: number = Date.now(), windowDays: number = DAILY_WINDOW_DAYS): TaskStats {
  const byStatus: Record<TaskStatus, number> = { unread: 0, active: 0, scheduled: 0, done: 0 };
  const categories = new Map<string, number>();
  let overdue = 0;

  const today = startOfDay(now);
  // 古い日 → 今日。夏時間などで 1 日が 24 時間でない日があっても、日付で数えるので影響しない
  const days = Array.from({ length: windowDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (windowDays - 1 - i));
    return { date: d, count: 0 };
  });
  const dayIndex = new Map(days.map((d, i) => [d.date.getTime(), i]));

  for (const task of tasks) {
    byStatus[task.status]++;
    categories.set(task.category, (categories.get(task.category) ?? 0) + 1);
    if (task.status !== "done" && task.scheduledAt && new Date(task.scheduledAt).getTime() < now) overdue++;

    const created = new Date(task.createdAt).getTime();
    if (!Number.isNaN(created)) {
      const i = dayIndex.get(startOfDay(created));
      if (i !== undefined) days[i].count++;
    }
  }

  const total = tasks.length;
  const weekStart = today - 6 * DAY_MS;
  const createdThisWeek = tasks.filter((t) => {
    const created = new Date(t.createdAt).getTime();
    return !Number.isNaN(created) && created >= weekStart && created < today + DAY_MS;
  }).length;

  return {
    total,
    byStatus,
    open: total - byStatus.done,
    completionRate: total === 0 ? 0 : byStatus.done / total,
    overdue,
    createdThisWeek,
    byCategory: [...categories.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja")),
    createdPerDay: days,
  };
}

/**
 * 多いカテゴリを上位 limit 件だけ残し、残りは「その他」にまとめる。
 * 件数を限らないと、項目が多いときに棒が細かくなり読めなくなる。
 */
export function foldCategories(
  categories: { name: string; count: number }[],
  limit: number,
): { name: string; count: number; folded?: boolean }[] {
  if (categories.length <= limit) return categories;
  const head = categories.slice(0, limit - 1);
  const rest = categories.slice(limit - 1);
  return [...head, { name: "その他", count: rest.reduce((n, c) => n + c.count, 0), folded: true }];
}
