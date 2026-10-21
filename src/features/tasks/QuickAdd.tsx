import { useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";

/** 一覧の上にある、タイトルだけで素早くタスクを追加する入力欄（Enter で追加） */
export function QuickAdd() {
  const [title, setTitle] = useState("");
  const quickAddTask = useAppStore((s) => s.quickAddTask);
  const categoryFilter = useAppStore((s) => s.categoryFilter);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    quickAddTask(title);
    setTitle("");
  };

  return (
    <form onSubmit={submit} className="px-3 pb-2" aria-label="タスクをすばやく追加">
      <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-raised pl-2.5 pr-1 focus-within:border-focus">
        <Icon name="plus" size={15} className="shrink-0 text-subtle" />
        <input
          id="quick-add"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={categoryFilter ? `「${categoryFilter}」にタスクを追加` : "タスクを追加"}
          aria-label="タスクのタイトル"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-on-ink transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          追加
        </button>
      </div>
    </form>
  );
}
