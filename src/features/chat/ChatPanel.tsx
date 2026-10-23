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
  { value: "active", label: "進行中" },
  { value: "scheduled", label: "予定" },
  { value: "done", label: "完了" },
];

/** 会話の最初の一言の候補。押すと入力欄に入る（送信はしない） */
const SUGGESTIONS = [
  { icon: "list", title: "進め方を整理", description: "ゴールまでの手順を考える", prompt: "このタスクの進め方を提案して" },
  { icon: "note", title: "メモを要約", description: "大事なポイントを取り出す", prompt: "メモの内容を要約して" },
  { icon: "check", title: "次の一歩を決める", description: "今やることを明確にする", prompt: "次にやることを3つ挙げて" },
] as const;

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
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-new/20 bg-new-soft text-new">
          <Icon name="chat" size={28} />
        </div>
        <p className="text-lg font-semibold text-fg">タスクから、次の一歩へ。</p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">一覧からタスクを選ぶと、Claude と相談しながら作業を進められます。</p>
        <div className="mt-6 flex items-center gap-2 rounded-full border border-line bg-raised px-4 py-2 text-xs text-subtle">
          <Icon name="panelLeft" size={14} />
          タスクを選んで会話をはじめる
        </div>
      </div>
    );
  }

  // 許可確認の回答待ち（pending）も実行中として扱う
  const running = logs.some((l) => l.status === "running" || l.status === "pending");
  const pendingPermission = logs.find((l) => l.kind === "permission" && l.status === "pending");

  const send = () => {
    const message = draft.trim();
    if (!message || running) return;
    setDraft(task.id, "");
    void runAgent(task.id, message, chatModel);
  };

  const accent = categoryColorVar(task.category);

  const empty = (
    <div className="m-auto w-full max-w-xl shrink-0 animate-fade-in py-3">
      <div className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-new/20 bg-new-soft text-new shadow-sm">
        <Icon name="sparkle" size={22} />
      </div>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-new">CLAUDE WORKSPACE</p>
      <h2 className="mt-2 text-2xl font-semibold leading-snug tracking-tight text-fg">どこから、進めましょう？</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        計画の整理から具体的な作業まで。このタスクのメモをもとに相談でき、会話の続きはいつでも再開できます。
      </p>
      <div className="mt-5 grid gap-2 min-[1200px]:grid-cols-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            onClick={() => {
              setDraft(task.id, draft.trim() ? `${draft.trimEnd()}\n${s.prompt}` : s.prompt);
              document.getElementById("chat-input")?.focus();
            }}
            aria-label={`${s.title}：入力欄に追加`}
            className="group flex items-center gap-3 rounded-xl border border-line bg-raised p-3 text-left transition-colors hover:border-new/40 hover:bg-new-soft/40 min-[1200px]:flex-col min-[1200px]:items-start min-[1200px]:gap-2"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-hover text-muted transition-colors group-hover:bg-new-soft group-hover:text-new">
              <Icon name={s.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-fg">{s.title}</span>
              <span className="mt-0.5 block text-xs text-subtle">{s.description}</span>
            </span>
            <Icon name="chevronRight" size={16} className="shrink-0 text-subtle group-hover:text-new min-[1200px]:hidden" />
          </button>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle"><Icon name="edit" size={12} /> 選ぶと入力欄に追加されます。編集してから送信できます。</p>
    </div>
  );

  return (
    <>
      <div className="shrink-0 border-b border-line bg-surface px-5 pb-4 pt-4">
        <Breadcrumbs
          items={[
            { label: "すべて", onClick: () => setCategoryFilter(null) },
            { label: task.category, dotColor: accent, onClick: () => setCategoryFilter(task.category) },
            { label: task.title },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-[12rem] flex-1">
            <h1 className="truncate text-xl font-semibold leading-snug tracking-tight text-fg" title={task.title}>{task.title}</h1>
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
                ...(task.status === "unread" ? [{ value: "unread" as const, label: "未読" }] : []),
                ...STATUS_OPTIONS,
              ]}
              menuMinWidth={140}
              className="w-28"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-subtle">
          <Icon name="sparkle" size={13} className="text-new" />
          <span>タスク専用チャット</span>
          <span aria-hidden="true">·</span>
          <span>{logs.filter((log) => log.sender === "user").length} 件の依頼</span>
        </div>
      </div>

      <AiLogView taskId={task.id} logs={logs} empty={empty} />

      <ChatComposer
        value={draft}
        onChange={(v) => setDraft(task.id, v)}
        onSend={send}
        onStop={() => stopAgent(task.id)}
        running={running}
        awaitingPermission={!!pendingPermission}
        onReviewPermission={() => {
          if (!pendingPermission) return;
          const card = document.getElementById(`permission-${pendingPermission.id}`);
          card?.scrollIntoView({ behavior: "smooth", block: "center" });
          card?.focus({ preventScroll: true });
        }}
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
