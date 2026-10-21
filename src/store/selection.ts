import type { Task } from "../types";

/**
 * 選択するタスクの ID を決める。
 * 1. 希望の ID（再起動前の選択など）が tasks にあれば、それを選ぶ
 * 2. なければ（削除された・保存値が古い、など）先頭の未完了タスク
 * 3. 未完了がなければ先頭のタスク
 * 4. タスクがなければ null（選択なし）
 *
 * 選ぶだけで、タスクの状態は変えない（未読 → Active への変更は selectTask の役割）。
 */
export function resolveSelectedTaskId(tasks: Task[], preferredId: string | null): string | null {
  const preferred = preferredId ? tasks.find((t) => t.id === preferredId) : undefined;
  return (preferred ?? tasks.find((t) => t.status !== "done") ?? tasks[0])?.id ?? null;
}
