import { useMemo } from "react";
import { useAppStore } from "../../store/useAppStore";

export function ProjectTabs() {
  const tasks = useAppStore((s) => s.tasks);
  const projectFilter = useAppStore((s) => s.projectFilter);
  const setProjectFilter = useAppStore((s) => s.setProjectFilter);
  const projects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) if (task.project) counts.set(task.project, (counts.get(task.project) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
  }, [tasks]);
  if (!projects.length) return null;
  const tab = (active: boolean) => `flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${active ? "bg-info-soft text-info" : "text-muted hover:bg-hover hover:text-fg"}`;
  return <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]"><button aria-pressed={projectFilter === null} onClick={() => setProjectFilter(null)} className={tab(projectFilter === null)}>すべてのPJ</button>{projects.map((project) => <button key={project.name} aria-pressed={projectFilter === project.name} onClick={() => setProjectFilter(projectFilter === project.name ? null : project.name)} className={tab(projectFilter === project.name)}>{project.name}<span className="tabular-nums opacity-70">{project.count}</span></button>)}</div>;
}
