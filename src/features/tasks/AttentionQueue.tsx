import { useMemo } from "react";
import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";
import { getAttentionTasks, type AttentionKind } from "./attentionTasks";

const LABELS: Record<AttentionKind, string> = { overdue: "期限切れ", unread: "未読", today: "今日" };
const COLORS: Record<AttentionKind, string> = { overdue: "bg-warn-soft text-warn", unread: "bg-new-soft text-new", today: "bg-info-soft text-info" };

export function AttentionQueue() {
  const tasks = useAppStore((s) => s.tasks);
  const selectTask = useAppStore((s) => s.selectTask);
  const attention = useMemo(() => getAttentionTasks(tasks), [tasks]);
  if (attention.length === 0) return null;
  const current = attention[0];

  return <button type="button" onClick={() => selectTask(current.task.id)} className="mx-4 mb-2 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-raised">
    <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${COLORS[current.kind]}`}><Icon name={current.kind === "overdue" ? "alert" : current.kind === "unread" ? "mail" : "clock"} size={14} /></span>
    <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold text-subtle">要対応 {attention.length}件</span><span className="block truncate text-xs font-medium text-fg">{current.task.title}</span></span>
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${COLORS[current.kind]}`}>{LABELS[current.kind]}</span>
    <Icon name="chevronRight" size={14} className="shrink-0 text-subtle" />
  </button>;
}
