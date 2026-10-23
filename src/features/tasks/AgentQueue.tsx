import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";

/** 同時に走っているAI作業へすぐ戻るための小さなキュー。 */
export function AgentQueue() {
  const runningIds = useAppStore((s) => s.runningTaskIds);
  const tasks = useAppStore((s) => s.tasks);
  const selectTask = useAppStore((s) => s.selectTask);
  const running = runningIds.map((id) => tasks.find((task) => task.id === id)).filter((task): task is NonNullable<typeof task> => Boolean(task));
  if (running.length === 0) return null;

  return (
    <section className="mx-4 mb-2 rounded-xl border border-new/25 bg-new-soft/40 p-2.5" aria-label="AI作業中">
      <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-new">
        <span className="size-2 animate-pulse rounded-full bg-new" aria-hidden="true" />
        AI作業中 <span className="tabular-nums">{running.length}</span>
      </div>
      <div className="mt-2 space-y-1">
        {running.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => selectTask(task.id)}
            className="flex w-full items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-left text-xs hover:bg-hover"
          >
            <Icon name="sparkle" size={13} className="shrink-0 animate-pulse text-new" />
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{task.title}</span>
            <Icon name="chevronRight" size={13} className="shrink-0 text-subtle" />
          </button>
        ))}
      </div>
    </section>
  );
}
