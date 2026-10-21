import { Icon, type IconName } from "../../components/Icon";
import { useAppStore, useSelectedTask } from "../../store/useAppStore";
import type { ContextTab } from "../../types";
import { BrowserTab } from "./BrowserTab";
import { MemoTab } from "./MemoTab";
import { MessagesTab } from "./MessagesTab";

const TABS: { id: ContextTab; label: string; icon: IconName }[] = [
  { id: "memo", label: "メモ", icon: "note" },
  { id: "browser", label: "ブラウザ", icon: "globe" },
  { id: "messages", label: "メッセージ", icon: "mail" },
];

export function ContextPanel() {
  const task = useSelectedTask();
  const tab = useAppStore((s) => s.activeContextTab);
  const setTab = useAppStore((s) => s.setActiveContextTab);
  const messageCount = useAppStore((s) => (task ? (s.messages[task.id]?.length ?? 0) : 0));

  return (
    <>
      <div role="tablist" aria-label="コンテキスト" className="flex shrink-0 gap-1 border-b border-line px-2 pt-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              id={`ctx-tab-${t.id}`}
              aria-selected={active}
              aria-controls="ctx-panel"
              onClick={() => setTab(t.id)}
              // 選択中のタブは、下の線で示す（色だけに頼らない）
              className={`relative flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition-colors ${
                active ? "text-fg" : "text-subtle hover:bg-hover hover:text-fg"
              }`}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
              {t.id === "messages" && messageCount > 0 && (
                <span className="rounded-full bg-hover px-1.5 text-[10px] tabular-nums text-muted">{messageCount}</span>
              )}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 animate-fade-in rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>
      <div id="ctx-panel" role="tabpanel" aria-labelledby={`ctx-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
        {task ? (
          // key で切り替えることで、タスク変更時にタブ内のローカル状態をリセットする
          <div key={`${task.id}:${tab}`} className="flex min-h-0 flex-1 animate-fade-in flex-col">
            {tab === "memo" && <MemoTab taskId={task.id} />}
            {tab === "browser" && <BrowserTab />}
            {tab === "messages" && <MessagesTab taskId={task.id} />}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-sm text-subtle">タスクを選択してください</p>
          </div>
        )}
      </div>
    </>
  );
}
