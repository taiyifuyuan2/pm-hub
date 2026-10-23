import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";
import type { Task, TaskAssignee } from "../../types";

const rank = (task: Task) => ({ unread: 0, active: 1, scheduled: 2, done: 3 })[task.status];
const ownerLabel: Record<TaskAssignee, string> = { me: "自分", ai: "AI", vice: "Vice" };

export function ProjectTab({ task }: { task: Task }) {
  const tasks = useAppStore((s) => s.tasks);
  const runningIds = useAppStore((s) => s.runningTaskIds);
  const selectTask = useAppStore((s) => s.selectTask);
  if (!task.project) return <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><Icon name="folder" size={22} className="text-subtle" /><p className="mt-3 text-sm font-medium text-fg">プロジェクトが未設定です</p><p className="mt-1 text-xs leading-relaxed text-subtle">タスク編集からプロジェクトを追加すると、関連タスクをここで確認できます。</p></div>;

  const related = tasks.filter((item) => item.project === task.project).sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  const open = related.filter((item) => item.status !== "done").length;
  const done = related.length - open;
  const owners = related.reduce<Record<TaskAssignee, number>>((acc, item) => { acc[item.assignee ?? "me"] += 1; return acc; }, { me: 0, ai: 0, vice: 0 });
  const progress = related.length ? Math.round((done / related.length) * 100) : 0;

  return <div className="min-h-0 flex-1 overflow-y-auto p-4">
    <div className="rounded-xl border border-info/20 bg-info-soft p-3"><p className="text-[11px] font-medium text-info">PROJECT</p><h3 className="mt-1 truncate text-base font-semibold text-fg">{task.project}</h3><div className="mt-2 flex items-center justify-between text-xs text-muted"><span>{related.length}件中 {open}件が進行中</span><span className="font-semibold text-fg">{progress}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-info" style={{ width: `${progress}%` }} /></div></div>
    <div className="mt-3 grid grid-cols-3 gap-1.5">{(["me", "ai", "vice"] as const).map((owner) => <div key={owner} className="rounded-lg border border-line bg-surface px-2 py-2 text-center"><p className="text-[10px] text-subtle">{ownerLabel[owner]}</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-fg">{owners[owner]}</p></div>)}</div>
    <div className="mt-4"><p className="mb-2 text-xs font-semibold text-fg">このプロジェクトのタスク</p><div className="space-y-1.5">{related.map((item) => <button key={item.id} onClick={() => selectTask(item.id)} className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left text-xs ${item.id === task.id ? "border-info bg-info-soft" : "border-line bg-surface hover:bg-hover"}`}><span className={`size-2 shrink-0 rounded-full ${item.status === "done" ? "bg-subtle" : item.status === "unread" ? "bg-new" : "bg-info"}`} /><span className={`min-w-0 flex-1 truncate ${item.status === "done" ? "text-subtle line-through" : "font-medium text-fg"}`}>{item.title}</span>{runningIds.includes(item.id) && <Icon name="sparkle" size={12} className="shrink-0 animate-pulse text-new" />}<span className="shrink-0 text-[10px] text-subtle">{ownerLabel[item.assignee ?? "me"]}</span>{item.id === task.id && <Icon name="chevronRight" size={13} className="text-info" />}</button>)}</div></div>
  </div>;
}
