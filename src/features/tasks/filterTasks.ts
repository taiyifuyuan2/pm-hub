import type { Task, TaskStatus } from "../../types";

export type SortBy = "created-desc" | "created-asc" | "scheduled-asc" | "title-asc";
export type StatusFilter = "all" | TaskStatus;

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "created-desc", label: "作成日が新しい順" },
  { value: "created-asc", label: "作成日が古い順" },
  { value: "scheduled-asc", label: "予定日が近い順" },
  { value: "title-asc", label: "タイトル順" },
];

/** 大文字小文字・全角半角（Ａ と A など）の違いを無視して比較するための正規化 */
const normalize = (text: string) => text.normalize("NFKC").toLowerCase();

const time = (iso: string) => new Date(iso).getTime();

/** 先頭に来るほど小さい値を返す比較関数。同順位は作成日の新しい順にして、表示順を安定させる */
const COMPARATORS: Record<SortBy, (a: Task, b: Task) => number> = {
  "created-desc": (a, b) => time(b.createdAt) - time(a.createdAt),
  "created-asc": (a, b) => time(a.createdAt) - time(b.createdAt),
  "scheduled-asc": (a, b) => {
    // 予定日が未設定のタスクは末尾にする
    if (!a.scheduledAt && !b.scheduledAt) return 0;
    if (!a.scheduledAt) return 1;
    if (!b.scheduledAt) return -1;
    return time(a.scheduledAt) - time(b.scheduledAt);
  },
  "title-asc": (a, b) => a.title.localeCompare(b.title, "ja"),
};

/** タイトルまたはカテゴリに keyword が部分一致するか（空のキーワードはすべて一致） */
export function matchesQuery(task: Task, query: string): boolean {
  const keyword = normalize(query.trim());
  if (!keyword) return true;
  return normalize(task.title).includes(keyword) || normalize(task.category).includes(keyword);
}

/** ステータスの絞り込み → キーワード検索 → 並べ替え を組み合わせたタスク一覧を返す */
export function filterAndSortTasks(
  tasks: Task[],
  { status, query, sortBy, category = null }: { status: StatusFilter; query: string; sortBy: SortBy; category?: string | null },
): Task[] {
  const compare = COMPARATORS[sortBy];
  return tasks
    .filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (category === null || t.category === category) &&
        matchesQuery(t, query),
    )
    .sort((a, b) => compare(a, b) || time(b.createdAt) - time(a.createdAt) || a.id.localeCompare(b.id));
}

export const TASK_STATUSES: readonly TaskStatus[] = ["unread", "active", "scheduled", "done"];

export interface TaskListGroups {
  /** ピン留めしたタスク（ステータスに関わらず最上部に独立して表示する） */
  pinned: Task[];
  /** ピン留めしていないタスクを、ステータスごとに分けたもの */
  byStatus: Record<TaskStatus, Task[]>;
}

/**
 * タスク一覧に表示するタスクを、「Pinned」と各ステータスのセクションに振り分ける。
 * - ピン留めしたタスクは Pinned だけに表示し、ステータスのセクションには重複して出さない
 * - ステータスのタブ・検索キーワード・並べ替えは、Pinned にも同じように適用する
 */
export function groupTasksForList(
  tasks: Task[],
  options: { status: StatusFilter; query: string; sortBy: SortBy; category?: string | null },
): TaskListGroups {
  const visible = filterAndSortTasks(tasks, options);
  return {
    pinned: visible.filter((t) => t.isPinned),
    byStatus: Object.fromEntries(
      TASK_STATUSES.map((status) => [status, visible.filter((t) => !t.isPinned && t.status === status)]),
    ) as Record<TaskStatus, Task[]>,
  };
}

/** カテゴリの一覧（タスクの数の多い順、同数なら名前順）。上部バーのカテゴリタブに使う */
export function listCategories(tasks: Task[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tasks) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}
