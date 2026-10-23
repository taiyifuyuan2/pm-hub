import { useMemo } from "react";
import { CHAT_MODELS } from "../../../shared/agent";
import { computeTaskStats } from "../../features/insights/taskStats";
import { useServerHealth } from "../../lib/useServerHealth";
import { useAppStore } from "../../store/useAppStore";
import { isSameDay } from "../../utils/format";
import { useCountUp } from "../../features/insights/useCountUp";

/**
 * 画面下の細いステータスバー（デスクトップ幅のみ）。
 * サーバーの接続状態、実行中のエージェントの数、今日作成したタスク、完了率のミニメーターを出す。
 */
export function StatusBar() {
  const health = useServerHealth();
  const tasks = useAppStore((s) => s.tasks);
  const runningCount = useAppStore((s) => s.runningTaskIds.length);
  const chatModel = useAppStore((s) => s.chatModel);
  const setInsightsOpen = useAppStore((s) => s.setInsightsOpen);
  const stats = useMemo(() => computeTaskStats(tasks), [tasks]);
  const createdToday = useMemo(() => tasks.filter((t) => isSameDay(t.createdAt)).length, [tasks]);
  const percent = useCountUp(Math.round(stats.completionRate * 100), 900);
  const modelLabel = CHAT_MODELS.find((m) => m.id === chatModel)?.label ?? "既定のモデル";

  return (
    <footer className="hidden h-9 shrink-0 items-center gap-4 border-t border-line bg-surface px-5 text-[11px] text-subtle lg:flex">
      <span className="flex items-center gap-1.5" title={health ? `接続中（${health.mode === "mock" ? "モック" : "Claude Code"}）` : "サーバーに接続できません"}>
        <span className={`size-1.5 rounded-full ${health ? (health.mode === "mock" ? "bg-warn" : "bg-new") : "bg-bad"}`} aria-hidden="true" />
        {health ? (health.mode === "mock" ? "モック" : "Claude Code") : "サーバー未接続"}
      </span>

      <span className="flex items-center gap-1.5">
        {runningCount > 0 && <span className="size-2.5 animate-spin-slow rounded-full border border-line-strong border-t-info" aria-hidden="true" />}
        実行中 <span className="font-medium tabular-nums text-muted">{runningCount}</span>
      </span>

      <span>
        今日の新規 <span className="font-medium tabular-nums text-muted">{createdToday}</span>
      </span>

      <span className="hidden xl:inline">モデル: {modelLabel}</span>

      <button
        type="button"
        onClick={() => setInsightsOpen(true)}
        className="ml-auto flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-hover hover:text-fg"
        aria-label={`完了率 ${Math.round(stats.completionRate * 100)} パーセント。押すと概要を開きます`}
      >
        完了率
        <span className="h-1 w-20 overflow-hidden rounded-full bg-viz-track" aria-hidden="true">
          <span className="viz-mark block h-full origin-left animate-grow-x rounded-full bg-viz-1" style={{ width: `${Math.round(stats.completionRate * 100)}%` }} />
        </span>
        <span className="w-8 text-right font-medium tabular-nums text-muted">{percent}%</span>
      </button>
    </footer>
  );
}
