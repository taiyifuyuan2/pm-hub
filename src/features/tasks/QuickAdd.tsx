import { useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";

/** 一覧の上にある、タイトルだけで素早くタスクを追加する入力欄（Enter で追加） */
export function QuickAdd() {
  const [title, setTitle] = useState("");
  const composing = useRef(false);
  const quickAddTask = useAppStore((s) => s.quickAddTask);
  const categoryFilter = useAppStore((s) => s.categoryFilter);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (composing.current || !title.trim()) return;
    quickAddTask(title);
    setTitle("");
  };

  return (
    <form onSubmit={submit} className="shrink-0 px-4 pb-2" aria-label="タスクをすばやく追加">
      <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface py-1 pl-3 pr-1.5 transition-colors focus-within:border-focus focus-within:ring-2 focus-within:ring-info/10">
        <Icon name="plus" size={17} className="shrink-0 text-info" />
        <input
          id="quick-add"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault();
          }}
          placeholder={categoryFilter ? `「${categoryFilter}」に追加` : "次にやることを追加…"}
          aria-label="タスクのタイトル"
          className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="h-8 shrink-0 rounded-lg bg-ink px-3 text-xs font-semibold text-on-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
        >
          追加
        </button>
      </div>
    </form>
  );
}
