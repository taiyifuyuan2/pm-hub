import { useRef } from "react";
import { Icon } from "../../components/Icon";
import { Select } from "../../components/Select";
import { SORT_OPTIONS, type SortBy, type StatusFilter } from "./filterTasks";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "unread", label: "未読" },
  { value: "active", label: "進行中" },
  { value: "scheduled", label: "予定" },
  { value: "done", label: "完了" },
];

interface TaskFilterBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  sortBy: SortBy;
  onSortChange: (sortBy: SortBy) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  /** ステータスごとの件数（検索キーワードで絞り込んだ後）。タブに表示する */
  counts: Record<StatusFilter, number>;
  totalVisible: number;
  totalTasks: number;
  isFiltering: boolean;
}

export function TaskFilterBar({
  query,
  onQueryChange,
  sortBy,
  onSortChange,
  status,
  onStatusChange,
  counts,
  totalVisible,
  totalTasks,
  isFiltering,
}: TaskFilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // ✖ で消した後は、そのまま次の検索語を打てるように入力欄へフォーカスを戻す
  const clearQuery = () => {
    onQueryChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="shrink-0 space-y-2 border-b border-line px-4 pb-2 pt-1">
      <div>
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            ref={inputRef}
            id="task-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && query && (e.preventDefault(), clearQuery())}
            placeholder="タイトル・カテゴリで検索"
            aria-label="タスクを検索"
            title="タスクを検索（Ctrl+K）"
            // type=search のブラウザ標準の ✖ は見た目が環境で異なるため、自前のボタンに統一する
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-xs text-fg outline-none transition-colors [appearance:none] placeholder:text-subtle hover:border-line-strong focus:border-focus [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              onClick={clearQuery}
              aria-label="検索ワードをクリア"
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-subtle hover:bg-hover hover:text-fg"
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div role="group" aria-label="ステータスで絞り込み" className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => onStatusChange(tab.value)}
                className={`flex min-h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-[11px] font-medium transition-colors ${
                  active ? "bg-info-soft font-semibold text-info" : "text-muted hover:bg-hover hover:text-fg"
                }`}
              >
                {tab.label}
                <span className={`tabular-nums ${active ? "text-info" : "text-subtle"}`}>{counts[tab.value]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <p className="text-[11px] text-subtle" role="status" aria-live="polite">
            <span className="font-semibold tabular-nums text-fg">{totalVisible}</span> 件{isFiltering ? ` / 全 ${totalTasks} 件` : "のタスク"}
          </p>
          <Select<SortBy>
            ariaLabel="並べ替え"
            size="sm"
            variant="ghost"
            value={sortBy}
            onChange={onSortChange}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            menuMinWidth={176}
            title="並べ替え"
            className="min-w-0"
          />
        </div>
      </div>
    </div>
  );
}
