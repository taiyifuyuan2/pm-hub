import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { parseViceTaskProposals } from "../utils/viceTasks";
import { Icon } from "./Icon";

export function ViceTaskCard({ source }: { source: string }) {
  const proposals = parseViceTaskProposals(source);
  const addTask = useAppStore((s) => s.addTask);
  const [added, setAdded] = useState<Set<number>>(() => new Set());
  if (!proposals) return null;

  const add = (index: number) => {
    const task = proposals[index];
    if (!task || added.has(index)) return;
    addTask({
      title: task.title,
      category: task.category,
      description: task.description,
      status: task.scheduledOn ? "scheduled" : "active",
      scheduledAt: task.scheduledOn ? new Date(`${task.scheduledOn}T09:00:00`).toISOString() : undefined,
    });
    setAdded((current) => new Set(current).add(index));
  };

  return (
    <section className="my-3 rounded-xl border border-new/30 bg-new-soft/40 p-3" aria-label="Vice からの提案タスク">
      <div className="flex items-center gap-2 text-xs font-semibold text-new"><Icon name="sparkle" size={14} />提案タスク</div>
      <div className="mt-2 space-y-2">
        {proposals.map((task, index) => (
          <div key={`${task.title}-${index}`} className="rounded-lg border border-line bg-raised p-3">
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{task.title}</p>
                <p className="mt-1 text-xs text-muted">{task.category}{task.scheduledOn ? ` · ${task.scheduledOn}` : ""}</p>
                {task.description && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted">{task.description}</p>}
              </div>
              <button type="button" onClick={() => add(index)} disabled={added.has(index)} className="h-8 shrink-0 rounded-lg bg-ink px-2.5 text-xs font-medium text-on-ink hover:opacity-90 disabled:bg-new disabled:opacity-100">
                {added.has(index) ? "追加済み" : "追加"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
