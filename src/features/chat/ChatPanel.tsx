import { useCallback, useEffect, useState } from "react";
import type { PermissionMode } from "../../../shared/agent";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { Select } from "../../components/Select";
import { api } from "../../lib/api";
import { useAppStore, useSelectedTask } from "../../store/useAppStore";
import type { AiLog, TaskStatus } from "../../types";
import { categoryColorVar } from "../../utils/category";
import { AiLogView } from "./AiLogView";
import { ChatComposer } from "./ChatComposer";
import { PermissionRulesDialog } from "./PermissionRulesDialog";
import { runAgent, stopAgent } from "./runAgent";

const EMPTY_LOGS: AiLog[] = [];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "done", label: "Done" },
];

/** 会話の最初の一言の候補。押すと入力欄に入る（送信はしない） */
const SUGGESTIONS = ["このタスクの進め方を提案して", "メモの内容を要約して", "次にやることを3つ挙げて"];

export function ChatPanel() {
  const task = useSelectedTask();
  const logs = useAppStore((s) => (task ? s.aiLogs[task.id] : undefined) ?? EMPTY_LOGS);
  const updateTaskStatus = useAppStore((s) => s.updateTaskStatus);
  const togglePin = useAppStore((s) => s.togglePin);
  const setCategoryFilter = useAppStore((s) => s.setCategoryFilter);
  const draft = useAppStore((s) => (task ? s.drafts[task.id] : undefined) ?? "");
  const setDraft = useAppStore((s) => s.setDraft);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleCount, setRuleCount] = useState(0);
  // 「このセッション中すべて許可」が有効か（全ツールに合致するルールの有無）
  const [allowAll, setAllowAll] = useState(false);
  const [confirmAllowAll, setConfirmAllowAll] = useState(false);
  const chatModel = useAppStore((s) => s.chatModel);
  const setChatModel = useAppStore((s) => s.setChatModel);

  // このタスクの許可ルール。ルールが増減しうるのは許可カードの回答時なので、ログ件数の変化に合わせて取得し直す
  const taskId = task?.id;
  const logCount = logs.length;
  const loadRuleCount = useCallback(() => {
    if (!taskId) {
      setRuleCount(0);
      setAllowAll(false);
      return;
    }
    api
      .permissionRules(taskId)
      .then((res) => {
        setRuleCount(res.rules.length);
        setAllowAll(res.rules.some((r) => r.toolName === "*"));
      })
      .catch(() => {
        setRuleCount(0);
        setAllowAll(false);
      });
  }, [taskId]);
  useEffect(loadRuleCount, [loadRuleCount, logCount]);

  const changePermissionMode = (mode: PermissionMode) => {
    if (!taskId) return;
    // 確認なしの状態にするときは、何が起きるかを確認してから切り替える。手動確認に戻すのは確認なしで行う
    if (mode === "allow-all") return setConfirmAllowAll(true);
    void api.setPermissionMode(taskId, mode).then(loadRuleCount);
  };

  if (!task) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-hover text-subtle">
          <Icon name="chat" size={22} />
        </div>
        <p className="text-sm font-medium text-fg">タスクを選んでください</p>
        <p className="mt-1 text-xs text-subtle">左の一覧から選ぶと、紐づくAIエージェントとの会話がここに表示されます</p>
      </div>
    );
  }

  // 許可確認の回答待ち（pending）も実行中として扱う
  const running = logs.some((l) => l.status === "running" || l.status === "pending");

  const send = () => {
    const message = draft.trim();
    if (!message || running) return;
    setDraft(task.id, "");
    void runAgent(task.id, message, chatModel);
  };

  const accent = categoryColorVar(task.category);

  const empty = (
    <div className="m-auto flex max-w-sm animate-fade-in flex-col items-center py-8 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-hover text-fg">
        <Icon name="sparkle" size={22} />
      </div>
      <p className="text-sm font-semibold text-fg">このタスクについて、Claude に頼んでみましょう</p>
      <p className="mt-1 text-xs leading-relaxed text-subtle">
        下の入力欄から指示を送ると、このタスク専用のフォルダで作業し、会話は次回以降も引き継がれます。
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setDraft(task.id, s);
              document.getElementById("chat-input")?.focus();
            }}
            className="rounded-full border border-line-strong bg-raised px-3 py-1.5 text-xs text-muted transition-colors hover:border-subtle hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="shrink-0 border-b border-line px-5 pb-3 pt-3">
        <Breadcrumbs
          items={[
            { label: "すべて", onClick: () => setCategoryFilter(null) },
            { label: task.category, dotColor: accent, onClick: () => setCategoryFilter(task.category) },
            { label: task.title },
          ]}
        />
        <div className="mt-1.5 flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-[12rem] flex-1">
            <h1 className="truncate text-lg font-semibold leading-snug text-fg">{task.title}</h1>
            {task.description && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{task.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => togglePin(task.id)}
              aria-label={task.isPinned ? "ピン留めを解除" : "ピン留め"}
              aria-pressed={task.isPinned}
              title={task.isPinned ? "ピン留めを解除" : "ピン留め"}
              className={`rounded-md p-1.5 hover:bg-hover ${task.isPinned ? "text-fg" : "text-subtle hover:text-fg"}`}
            >
              <Icon name="pin" size={16} />
            </button>
            <button
              onClick={() => setRulesOpen(true)}
              aria-label="許可ルール管理"
              title="許可ルール管理"
              className="relative rounded-md p-1.5 text-subtle hover:bg-hover hover:text-fg"
            >
              <Icon name="gear" size={16} />
              {ruleCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-new px-1 text-center text-[10px] font-semibold leading-4 text-on-ink tabular-nums">
                  {ruleCount}
                </span>
              )}
            </button>
            <Select<TaskStatus>
              ariaLabel="ステータス"
              size="sm"
              value={task.status}
              onChange={(s) => updateTaskStatus(task.id, s)}
              options={[
                ...(task.status === "unread" ? [{ value: "unread" as const, label: "Unread" }] : []),
                ...STATUS_OPTIONS,
              ]}
              menuMinWidth={140}
              className="w-28"
            />
          </div>
        </div>
      </div>

      <AiLogView taskId={task.id} logs={logs} empty={empty} />

      <ChatComposer
        value={draft}
        onChange={(v) => setDraft(task.id, v)}
        onSend={send}
        onStop={() => stopAgent(task.id)}
        running={running}
        permissionMode={allowAll ? "allow-all" : "manual"}
        onPermissionModeChange={changePermissionMode}
        model={chatModel}
        onModelChange={setChatModel}
      />

      {confirmAllowAll && (
        <ConfirmDialog
          title="このセッション中すべて許可"
          confirmLabel="すべて許可にする"
          danger
          onConfirm={() => api.setPermissionMode(task.id, "allow-all").then(loadRuleCount)}
          onClose={() => setConfirmAllowAll(false)}
        >
          <p>「{task.title}」では、ファイルの作成・編集やコマンドの実行を、確認なしで許可します。</p>
          <p className="mt-2 text-xs text-subtle">
            会話をリセットするか、「手動確認」に戻すまで続きます。削除などの危険な操作も確認されなくなります。
          </p>
        </ConfirmDialog>
      )}
      {rulesOpen && (
        <PermissionRulesDialog
          taskId={task.id}
          taskTitle={task.title}
          onClose={() => setRulesOpen(false)}
          onChanged={loadRuleCount}
        />
      )}
    </>
  );
}
