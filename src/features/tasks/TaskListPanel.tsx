import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { PullToRefresh } from "../../components/PullToRefresh";
import { useAppStore } from "../../store/useAppStore";
import type { SectionKey } from "../../store/uiSettings";
import type { Task, TaskStatus } from "../../types";
import { formatToday } from "../../utils/format";
import { groupTasksForList, matchesQuery, type StatusFilter } from "./filterTasks";
import { QuickAdd } from "./QuickAdd";
import { AgentQueue } from "./AgentQueue";
import { StatusStrip } from "./StatusStrip";
import { TaskFilterBar } from "./TaskFilterBar";
import { TaskFormDialog } from "./TaskFormDialog";
import { TaskItem } from "./TaskItem";

const SECTIONS: { status: TaskStatus; label: string }[] = [
  { status: "unread", label: "未読" },
  { status: "active", label: "進行中" },
  { status: "scheduled", label: "予定" },
  { status: "done", label: "完了" },
];

/** 開いているダイアログ */
type DialogState = { type: "create" } | { type: "edit"; task: Task } | { type: "delete"; task: Task } | null;

export function TaskListPanel() {
  const tasks = useAppStore((s) => s.tasks);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectTask = useAppStore((s) => s.selectTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const refresh = useAppStore((s) => s.refresh);
  const refreshing = useAppStore((s) => s.refreshing);
  const newTaskRequested = useAppStore((s) => s.newTaskRequested);
  const clearNewTaskRequest = useAppStore((s) => s.clearNewTaskRequest);
  const collapsedSections = useAppStore((s) => s.collapsedSections);
  const toggleSection = useAppStore((s) => s.toggleSection);
  const [dialog, setDialog] = useState<DialogState>(null);
  const closeDialog = () => setDialog(null);

  // 検索語・ソート・ステータスタブ・カテゴリはストアで持ち、アプリを再起動しても復元される（localStorage に保存）
  const query = useAppStore((s) => s.searchQuery);
  const setQuery = useAppStore((s) => s.setSearchQuery);
  const sortBy = useAppStore((s) => s.sortBy);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const statusFilter = useAppStore((s) => s.statusFilter);
  const setStatusFilter = useAppStore((s) => s.setStatusFilter);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const setCategoryFilter = useAppStore((s) => s.setCategoryFilter);
  const projectFilter = useAppStore((s) => s.projectFilter);
  const setProjectFilter = useAppStore((s) => s.setProjectFilter);

  // ショートカット（Ctrl+N）や上部のボタンからの「新規タスク」の要求
  useEffect(() => {
    if (!newTaskRequested) return;
    clearNewTaskRequest();
    setDialog({ type: "create" });
  }, [newTaskRequested, clearNewTaskRequest]);

  // 絞り込み → 検索 → 並べ替え を行い、ピン留めしたタスク（Pinned）とステータスごとのセクションに振り分ける
  const sectionsToShow = SECTIONS.filter((s) => statusFilter === "all" || s.status === statusFilter);
  const { pinned, byStatus: visibleBySection } = useMemo(
    () => groupTasksForList(tasks, { status: statusFilter, query, sortBy, category: categoryFilter, project: projectFilter }),
    [tasks, statusFilter, query, sortBy, categoryFilter, projectFilter],
  );
  // タブの件数は、ステータスでは絞らず、検索キーワードとカテゴリだけを反映する
  const counts = useMemo(() => {
    const matched = tasks.filter((t) => (categoryFilter === null || t.category === categoryFilter) && (projectFilter === null || t.project === projectFilter) && matchesQuery(t, query));
    return {
      all: matched.length,
      unread: matched.filter((t) => t.status === "unread").length,
      active: matched.filter((t) => t.status === "active").length,
      scheduled: matched.filter((t) => t.status === "scheduled").length,
      done: matched.filter((t) => t.status === "done").length,
    } satisfies Record<StatusFilter, number>;
  }, [tasks, query, categoryFilter]);

  const totalVisible = pinned.length + sectionsToShow.reduce((n, { status }) => n + visibleBySection[status].length, 0);
  const isFiltering = query.trim() !== "" || statusFilter !== "all" || categoryFilter !== null || projectFilter !== null;

  // 画面に出ている順（Pinned → 各セクション）。折りたたんだ中のタスクは含めない。Alt+↑/↓ の移動に使う
  const visibleOrder = useMemo(() => {
    const ids = pinned.filter(() => !collapsedSections.includes("pinned")).map((t) => t.id);
    for (const { status } of sectionsToShow) {
      if (!collapsedSections.includes(status)) ids.push(...visibleBySection[status].map((t) => t.id));
    }
    return ids;
  }, [pinned, sectionsToShow, visibleBySection, collapsedSections]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
      if (visibleOrder.length === 0) return;
      e.preventDefault();
      const i = visibleOrder.indexOf(selectedTaskId ?? "");
      const next = e.key === "ArrowDown" ? Math.min(visibleOrder.length - 1, i + 1) : Math.max(0, i === -1 ? 0 : i - 1);
      selectTask(visibleOrder[next]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visibleOrder, selectedTaskId, selectTask]);

  const renderTask = (task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      selected={task.id === selectedTaskId}
      onSelect={() => selectTask(task.id)}
      onEdit={() => setDialog({ type: "edit", task })}
      onDelete={() => setDialog({ type: "delete", task })}
    />
  );

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setCategoryFilter(null);
    setProjectFilter(null);
  };

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-3 pt-4">
        <div>
          <p className="mb-1 text-[11px] font-medium text-subtle">{formatToday()}</p>
          <h2 className="text-xl font-semibold tracking-tight text-fg">マイタスク</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void refresh().catch(() => {})}
            aria-label="一覧を更新"
            disabled={refreshing}
            title="一覧を更新（一覧の一番上で下へ引っ張っても更新できます）"
            className="flex size-9 items-center justify-center rounded-lg text-subtle hover:bg-hover hover:text-fg disabled:opacity-50"
          >
            <Icon name="refresh" size={15} className={refreshing ? "animate-spin-slow" : ""} />
          </button>
          <button
            onClick={() => setDialog({ type: "create" })}
            aria-label="新規タスク（詳細を指定して作成）"
            title="新規タスク（Ctrl+N）"
            className="flex h-9 items-center gap-1 rounded-lg border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg hover:bg-hover"
          >
            <Icon name="plus" size={15} />
            新規
          </button>
        </div>
      </div>

      <QuickAdd />
      <AgentQueue />
      <StatusStrip />
      <TaskFilterBar
        query={query}
        onQueryChange={setQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        counts={counts}
        totalVisible={totalVisible}
        totalTasks={tasks.length}
        isFiltering={isFiltering}
      />

      {categoryFilter !== null && (
        <div className="flex shrink-0 items-center gap-2 px-4 pt-3 text-xs text-muted">
          カテゴリ:
          <button
            onClick={() => setCategoryFilter(null)}
            className="flex min-w-0 items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 font-medium text-info hover:bg-hover"
            aria-label={`カテゴリ「${categoryFilter}」の絞り込みを解除`}
          >
            <span className="truncate">{categoryFilter}</span>
            <Icon name="x" size={12} className="shrink-0" />
          </button>
        </div>
      )}

      {isFiltering && (
        <div className="flex shrink-0 justify-end px-4 pt-1 text-[11px]">
          <button onClick={resetFilters} className="flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-info hover:bg-info-soft">
            <Icon name="x" size={12} />絞り込みを解除
          </button>
        </div>
      )}

      <PullToRefresh onRefresh={refresh}>
        <div className="px-3 pb-4 pt-1">
          {totalVisible === 0 && (
            <div className="flex animate-fade-in flex-col items-center px-4 py-10 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-hover text-subtle">
                <Icon name={isFiltering ? "search" : "list"} size={22} />
              </div>
              <p className="text-sm font-semibold text-fg">{isFiltering ? "一致するタスクはありません" : "最初のタスクを追加しましょう"}</p>
              <p className="mt-1 text-xs text-subtle">
                {isFiltering ? "検索語や絞り込みを変えてみてください" : "上の入力欄に書いて、Enter で追加できます"}
              </p>
              {isFiltering && (
                <button onClick={resetFilters} className="mt-3 rounded-md px-3 py-1.5 text-xs font-medium text-info hover:bg-hover">
                  検索条件をリセット
                </button>
              )}
              {!isFiltering && (
                <button onClick={() => setDialog({ type: "create" })} className="mt-4 flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-on-ink hover:opacity-90">
                  <Icon name="plus" size={14} />タスクを作成
                </button>
              )}
            </div>
          )}

          {pinned.length > 0 && (
            <Section id="pinned" label="ピン留め" count={pinned.length} collapsed={collapsedSections.includes("pinned")} onToggle={toggleSection}>
              {pinned.map(renderTask)}
            </Section>
          )}

          {sectionsToShow.map(({ status, label }) => {
            const sectionTasks = visibleBySection[status];
            // 空のセクションを省き、取り組めるタスクを見つけやすくする
            if (sectionTasks.length === 0) return null;
            return (
              <Section
                key={status}
                id={status}
                label={label}
                count={sectionTasks.length}
                collapsed={collapsedSections.includes(status)}
                onToggle={toggleSection}
              >
                {sectionTasks.map(renderTask)}
              </Section>
            );
          })}
        </div>
      </PullToRefresh>

      {dialog?.type === "create" && <TaskFormDialog onClose={closeDialog} />}
      {dialog?.type === "edit" && <TaskFormDialog task={dialog.task} onClose={closeDialog} />}
      {dialog?.type === "delete" && (
        <ConfirmDialog
          title="タスクを削除"
          confirmLabel="削除する"
          danger
          onConfirm={() => deleteTask(dialog.task.id)}
          onClose={closeDialog}
        >
          <p>
            「<span className="font-medium text-fg">{dialog.task.title}</span>」を削除しますか？
          </p>
          <p className="mt-2 text-xs text-subtle">
            関連するメモ・AIログ・メッセージ・Claude Code の会話履歴も削除されます。この操作は取り消せません。
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

interface SectionProps {
  id: SectionKey;
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: (id: SectionKey) => void;
  children: React.ReactNode;
}

/** 折りたためる一覧のセクション。折りたたみの状態は再起動後も保持される */
function Section({ id, label, count, collapsed, onToggle, children }: SectionProps) {
  return (
    <section className="mb-4" aria-label={label}>
      <h3>
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1.5 rounded-lg px-1 py-2 text-xs font-semibold text-muted hover:bg-hover hover:text-fg"
        >
          <Icon name="chevronDown" size={13} className={`transition-transform duration-150 ${collapsed ? "-rotate-90" : ""}`} />
          {id === "pinned" && <Icon name="pin" size={12} className="text-info" />}
          {label}
          <span className="ml-auto min-w-5 rounded-md bg-hover px-1.5 py-0.5 text-center text-[10px] font-medium tabular-nums text-subtle">{count}</span>
        </button>
      </h3>
      {!collapsed && <div className="mt-0.5 animate-fade-in space-y-2">{children}</div>}
    </section>
  );
}
