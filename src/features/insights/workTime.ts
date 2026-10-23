import type { Task, TaskTime } from "../../types";

export interface WorkTimeStats {
  totalSeconds: number;
  runningCount: number;
  byCategory: { name: string; seconds: number }[];
}

export function computeWorkTimeStats(tasks: Task[], times: Record<string, TaskTime>, now = Date.now()): WorkTimeStats {
  const categories = new Map<string, number>();
  let totalSeconds = 0;
  let runningCount = 0;
  for (const task of tasks) {
    const time = times[task.id];
    if (!time) continue;
    const running = time.runningSince ? Math.max(0, Math.floor((now - new Date(time.runningSince).getTime()) / 1000)) : 0;
    if (time.runningSince) runningCount++;
    const seconds = time.totalSeconds + running;
    totalSeconds += seconds;
    categories.set(task.category, (categories.get(task.category) ?? 0) + seconds);
  }
  return { totalSeconds, runningCount, byCategory: [...categories.entries()].map(([name, seconds]) => ({ name, seconds })).filter((row) => row.seconds > 0).sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name, "ja")) };
}

export function formatWorkTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
}
