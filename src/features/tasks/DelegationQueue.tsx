import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";
import type { Task, TaskAssignee } from "../../types";

const LABEL: Record<Exclude<TaskAssignee, "me">, string> = { ai: "AI", vice: "Vice" };

function DelegatedTask({ task, onSelect }: { task: Task; onSelect: () => void }) {
  const owner = task.assignee === "vice" ? "vice" : "ai";
  return <button type="button" onClick={onSelect} className="flex w-full items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-left text-xs hover:bg-hover">
    <span className={`flex size-5 shrink-0 items-center justify-center rounded-md ${owner === "vice" ? "bg-warn-soft text-warn" : "bg-new-soft text-new"}`}><Icon name={owner === "vice" ? "sparkle" : "clock"} size={12} /></span>
    <span className="min-w-0 flex-1 truncate font-medium text-fg">{task.title}</span>
    <span className="text-[10px] text-subtle">{LABEL[owner]}</span>
    <Icon name="chevronRight" size={13} className="shrink-0 text-subtle" />
  </button>;
}

/** 実行中のAIとは別に、AI/Viceへの判断待ち・着手待ちを表示する。 */
export function DelegationQueue() {
  const tasks = useAppStore((s) => s.tasks);
  const runningIds = useAppStore((s) => s.runningTaskIds);
  const selectTask = useAppStore((s) => s.selectTask);
  const delegated = tasks.filter((task) => task.status !== "done" && task.assignee && task.assignee !== "me" && !runningIds.includes(task.id));
  if (delegated.length === 0) return null;
  const visible = delegated.slice(0, 3);

  return <section className="mx-4 mb-2 rounded-xl border border-info/20 bg-info-soft/50 p-2.5" aria-label="委任中の仕事">
    <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-info"><Icon name="sparkle" size={13} />委任中 <span className="tabular-nums">{delegated.length}</span><span className="ml-auto font-normal text-subtle">AI / Vice</span></div>
    <div className="mt-2 space-y-1">{visible.map((task) => <DelegatedTask key={task.id} task={task} onSelect={() => selectTask(task.id)} />)}</div>
    {delegated.length > visible.length && <p className="px-1 pt-2 text-[10px] text-subtle">ほか {delegated.length - visible.length} 件</p>}
  </section>;
}
