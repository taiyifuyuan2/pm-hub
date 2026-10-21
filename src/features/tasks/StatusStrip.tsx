import { useMemo } from "react";
import { useAppStore } from "../../store/useAppStore";
import { computeTaskStats } from "../insights/taskStats";
import { STATUS_SEGMENTS } from "../insights/statusSegments";

/**
 * 一覧の上の、ステータスの割合を示す小さな帯（ミニ・インフォグラフィック）。
 * 色の帯は左から伸びるアニメーションで描かれ、押すと概要を開く。数字は帯の下に直接書く。
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
      className="group mx-3 mb-2 block w-[calc(100%-1.5rem)] rounded-lg px-1 py-1.5 text-left hover:bg-hover"
      aria-label={`ステータスの内訳: ${STATUS_SEGMENTS.map((s) => `${s.label} ${stats.byStatus[s.key]}件`).join("、")}。押すと概要を開きます`}
    >
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {STATUS_SEGMENTS.filter((s) => stats.byStatus[s.key] > 0).map((s, i) => (
          <span
            key={s.key}
            className="viz-mark h-full origin-left animate-grow-x rounded-sm"
            style={{ flexGrow: stats.byStatus[s.key], background: s.color, animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
        {STATUS_SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
            <span className="font-medium tabular-nums text-fg">{stats.byStatus[s.key]}</span>
          </span>
        ))}
      </div>
    </button>
  );
}
