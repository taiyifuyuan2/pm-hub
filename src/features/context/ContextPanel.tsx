import { Icon, type IconName } from "../../components/Icon";
import { useRef, type KeyboardEvent } from "react";
import { useAppStore, useSelectedTask } from "../../store/useAppStore";
import type { ContextTab } from "../../types";
import { BrowserTab } from "./BrowserTab";
import { MemoTab } from "./MemoTab";
import { MessagesTab } from "./MessagesTab";
import { ProjectTab } from "./ProjectTab";

const TABS: { id: ContextTab; label: string; icon: IconName }[] = [
  { id: "memo", label: "メモ", icon: "note" },
  { id: "browser", label: "ブラウザ", icon: "globe" },
  { id: "messages", label: "メッセージ", icon: "mail" },
  { id: "project", label: "PJ", icon: "folder" },
];

export function ContextPanel() {
  const task = useSelectedTask();
  const tab = useAppStore((s) => s.activeContextTab);
  const setTab = useAppStore((s) => s.setActiveContextTab);
  const messageCount = useAppStore((s) => (task ? (s.messages[task.id]?.length ?? 0) : 0));
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const navigateTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].id);
    tabButtons.current[next]?.focus();
  };

  return (
    <>
      <div className="shrink-0 px-4 pb-3 pt-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg"><Icon name="folder" size={16} />メモ・資料</div>
        <p className="text-[11px] leading-relaxed text-subtle">タスクの背景や、AIに伝えたい情報をここに。</p>
      </div>
      <div role="tablist" aria-label="コンテキスト" className="mx-3 mb-2 flex shrink-0 rounded-xl border border-line bg-hover p-1">
        {TABS.map((t, index) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => { tabButtons.current[index] = el; }}
              role="tab"
              tabIndex={active ? 0 : -1}
              id={`ctx-tab-${t.id}`}
              aria-selected={active}
              aria-controls="ctx-panel"
              onClick={() => setTab(t.id)}
              onKeyDown={(event) => navigateTab(event, index)}
              // 選択中のタブは、下の線で示す（色だけに頼らない）
              className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "bg-surface text-info shadow-sm" : "text-subtle hover:text-fg"
              }`}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
              {t.id === "messages" && messageCount > 0 && (
                <span className="rounded-full bg-hover px-1.5 text-[10px] tabular-nums text-muted">{messageCount}</span>
              )}
            </button>
          );
        })}
      </div>
      <div id="ctx-panel" role="tabpanel" tabIndex={0} aria-labelledby={`ctx-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
        {task ? (
          // key で切り替えることで、タスク変更時にタブ内のローカル状態をリセットする
          <div key={`${task.id}:${tab}`} className="flex min-h-0 flex-1 animate-fade-in flex-col">
            {tab === "memo" && <MemoTab taskId={task.id} />}
            {tab === "browser" && <BrowserTab />}
            {tab === "messages" && <MessagesTab taskId={task.id} />}
            {tab === "project" && <ProjectTab task={task} />}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-info"><Icon name="note" size={22} /></span>
            <p className="text-sm font-medium text-fg">必要な情報を、ひとつの場所に</p>
            <p className="text-xs leading-relaxed text-subtle">タスクを選ぶと、メモや関連するメッセージを確認できます。</p>
          </div>
        )}
      </div>
    </>
  );
}
