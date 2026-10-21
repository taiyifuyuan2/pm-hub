import { useRef } from "react";
import { Icon } from "../../components/Icon";
import { Select } from "../../components/Select";
import { SORT_OPTIONS, type SortBy, type StatusFilter } from "./filterTasks";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "unread", label: "Unread" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "done", label: "Done" },
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
}

export function TaskFilterBar({
  query,
  onQueryChange,
  sortBy,
  onSortChange,
  status,
  onStatusChange,
  counts,
}: TaskFilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // ✖ で消した後は、そのまま次の検索語を打てるように入力欄へフォーカスを戻す
  const clearQuery = () => {
    onQueryChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="shrink-0 space-y-2 border-b border-line px-3 pb-2.5 pt-1">
      <div>
        <div className="relative">
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            ref={inputRef}
            id="task-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && query && (e.preventDefault(), clearQuery())}
            placeholder="タイトル・カテゴリで検索（Ctrl+K）"
            aria-label="タスクを検索"
            // type=search のブラウザ標準の ✖ は見た目が環境で異なるため、自前のボタンに統一する
            className="h-8 w-full rounded-md border border-line-strong bg-raised pl-8 pr-8 text-xs text-fg outline-none [appearance:none] placeholder:text-subtle hover:border-subtle focus:border-focus [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              onClick={clearQuery}
              aria-label="検索ワードをクリア"
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-subtle hover:bg-hover hover:text-fg"
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div role="tablist" aria-label="ステータスで絞り込み" className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={active}
                onClick={() => onStatusChange(tab.value)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  active ? "bg-ink text-on-ink" : "text-muted hover:bg-hover hover:text-fg"
                }`}
              >
                {tab.label}
                <span className={`ml-1 tabular-nums ${active ? "opacity-70" : "text-subtle"}`}>{counts[tab.value]}</span>
              </button>
            );
          })}
        </div>
        <Select<SortBy>
          ariaLabel="並べ替え"
          size="sm"
          variant="ghost"
          value={sortBy}
          onChange={onSortChange}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          menuMinWidth={176}
          title="並べ替え"
          className="shrink-0 self-end"
        />
      </div>
    </div>
  );
}
