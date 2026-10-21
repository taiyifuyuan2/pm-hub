import { useMemo, useState } from "react";
import { Modal } from "../../components/Modal";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";
import { CategoryBars, DailyColumns, DataTables, HeroFigure, Meter, StatTile, StatusStack } from "./charts";
import { computeTaskStats } from "./taskStats";

type View = "chart" | "table";

/**
 * 概要（インフォグラフィック）。タスクの状況を、動くグラフと数字で一目で見せる。
 * すべてのグラフに「表で見る」の切り替えがあり、色だけに頼らず値を読める。
 */
export function InsightsDialog({ onClose }: { onClose: () => void }) {
  const tasks = useAppStore((s) => s.tasks);
  const refreshing = useAppStore((s) => s.refreshing);
  const stats = useMemo(() => computeTaskStats(tasks), [tasks]);
  const [view, setView] = useState<View>("chart");

  return (
    <Modal
      onClose={onClose}
      title="概要"
      width="max-w-2xl"
      eyebrow={<Breadcrumbs items={[{ label: "PM Hub" }, { label: "概要" }]} />}
    >
      {/* 表示の切り替え。この下のすべての内容が、同じ範囲（全タスク）を対象にする */}
      <div className="-mt-1 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          全タスク {stats.total} 件の状況です{refreshing ? "（更新中…）" : ""}
        </p>
        <div role="group" aria-label="表示の切り替え" className="flex rounded-lg bg-hover p-0.5 text-[11px]">
          {(
            [
              { id: "chart", label: "グラフ", icon: "chart" },
              { id: "table", label: "表で見る", icon: "list" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                view === v.id ? "bg-raised text-fg shadow-sm" : "text-subtle hover:text-fg"
              }`}
            >
              <Icon name={v.icon} size={12} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* 更新中は、グラフを消さずに少し薄くする（読み込みのちらつきを避ける） */}
      <div className={`transition-opacity duration-200 ${refreshing ? "opacity-60" : ""}`}>
        {view === "table" ? (
          <DataTables stats={stats} />
        ) : stats.total === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-hover text-subtle">
              <Icon name="chart" size={22} />
            </div>
            <p className="text-sm font-medium text-fg">まだタスクがありません</p>
            <p className="mt-1 text-xs text-subtle">タスクを追加すると、ここに状況が表示されます</p>
          </div>
        ) : (
          <div className="space-y-6">
            <HeroFigure value={stats.open} label="未完了のタスク" sub={`全 ${stats.total} 件のうち、完了は ${stats.byStatus.done} 件`} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="進行中" value={stats.byStatus.active} delay={0} />
              <StatTile label="予定" value={stats.byStatus.scheduled} delay={80} />
              <StatTile label="期限切れ" value={stats.overdue} sub={stats.overdue > 0 ? "予定をすぎています" : "ありません"} delay={160} critical={stats.overdue > 0} />
              <StatTile label="今週の新規" value={stats.createdThisWeek} sub="直近7日" delay={240} />
            </div>

            <Meter ratio={stats.completionRate} label="完了率" detail={`${stats.byStatus.done} / ${stats.total} 件を完了`} />

            <section aria-label="ステータスの内訳">
              <h3 className="mb-2.5 text-xs font-semibold text-fg">ステータスの内訳</h3>
              <StatusStack stats={stats} />
            </section>

            <div className="grid gap-6 sm:grid-cols-2">
              <section aria-label="カテゴリ別の件数">
                <h3 className="mb-2.5 text-xs font-semibold text-fg">カテゴリ別の件数</h3>
                <CategoryBars stats={stats} />
              </section>
              <section aria-label="直近の作成数">
                <h3 className="mb-2.5 text-xs font-semibold text-fg">直近 {stats.createdPerDay.length} 日の作成数</h3>
                <DailyColumns stats={stats} />
              </section>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
