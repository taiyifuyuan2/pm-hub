import { useMemo } from "react";
import { listCategories } from "../../features/tasks/filterTasks";
import { useAppStore } from "../../store/useAppStore";
import { categoryColorVar } from "../../utils/category";

/**
 * 上部バーのカテゴリタブ。色の点つきで、押すとそのカテゴリのタスクだけに絞り込む。
 * 数が多いときは横にスクロールできる（端は薄くぼかして、続きがあることを示す）。
 */
export function CategoryTabs() {
  const tasks = useAppStore((s) => s.tasks);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const setCategoryFilter = useAppStore((s) => s.setCategoryFilter);
  const categories = useMemo(() => listCategories(tasks), [tasks]);

  const tab = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
      active ? "bg-ink text-on-ink" : "text-muted hover:bg-hover hover:text-fg"
    }`;

  return (
    <div
      role="group"
      aria-label="カテゴリで絞り込み"
      className="flex min-w-0 items-center gap-1 overflow-x-auto [mask-image:linear-gradient(90deg,transparent,#000_12px,#000_calc(100%-16px),transparent)] [scrollbar-width:none] px-3"
    >
      <button aria-pressed={categoryFilter === null} onClick={() => setCategoryFilter(null)} className={tab(categoryFilter === null)}>
        すべてのタスク <span className="opacity-70 tabular-nums">{tasks.length}</span>
      </button>
      {categories.map((c) => {
        const active = categoryFilter === c.name;
        return (
          <button
            key={c.name}
            aria-pressed={active}
            onClick={() => setCategoryFilter(active ? null : c.name)}
            className={tab(active)}
            title={`${c.name}（${c.count}件）`}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: categoryColorVar(c.name) }} aria-hidden="true" />
            {c.name}
            <span className={`tabular-nums ${active ? "opacity-70" : "text-subtle"}`}>{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}
