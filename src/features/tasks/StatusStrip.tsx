import { useMemo } from "react";
import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";
import { computeTaskStats } from "../insights/taskStats";
import { STATUS_SEGMENTS } from "../insights/statusSegments";

/**
 * 完了件数と完了率を示す。押すと、ステータスの内訳を含む概要を開く。
 */
export function StatusStrip() {
  const tasks = useAppStore((s) => s.tasks);
  const setInsightsOpen = useAppStore((s) => s.setInsightsOpen);
  const stats = useMemo(() => computeTaskStats(tasks), [tasks]);
  if (stats.total === 0) return null;

  return (
    <button
      type="button"
      onClick={() => setInsightsOpen(true)}
      className="group mx-4 mb-2 block w-[calc(100%-2rem)] shrink-0 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-raised"
      aria-label={`ステータスの内訳: ${STATUS_SEGMENTS.map((s) => `${s.label} ${stats.byStatus[s.key]}件`).join("、")}。押すと概要を開きます`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-muted">進み具合 <span className="ml-1 tabular-nums text-fg">{stats.byStatus.done} / {stats.total} 件完了</span></span>
        <span className="flex items-center gap-1 text-info">概要<Icon name="chevronRight" size={12} /></span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true">
        <span className="viz-mark block h-full origin-left animate-grow-x rounded-full bg-ink" style={{ width: `${stats.completionRate * 100}%` }} />
      </div>
    </button>
  );
}
