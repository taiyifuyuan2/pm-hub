import type { TaskStatus } from "../../types";

/**
 * ステータスごとの、グラフでの色と並び順。
 * 色はパレットの slot 1～4 を、この順に固定して割り当てる（検証済み。色はタスクの状態に紐づき、並びや件数で変わらない）。
 * 「Done」を黄色にしているのは、slot 4 の位置だから。意味ではなく識別のための色で、必ず名前と件数を併記する。
 */
export const STATUS_SEGMENTS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "active", label: "進行中", color: "var(--viz-1)" },
  { key: "unread", label: "未読", color: "var(--viz-2)" },
  { key: "scheduled", label: "予定", color: "var(--viz-3)" },
  { key: "done", label: "完了", color: "var(--viz-4)" },
];
