import type { ChatModelId } from "../../../shared/agent";
import { streamChat } from "../../lib/agentClient";
import { api } from "../../lib/api";
import type { PermissionDecision } from "../../types";
import { notifyOs } from "../../store/inboxStore";
import { useAppStore } from "../../store/useAppStore";
import { toast } from "../../store/toastStore";

/** taskId → 実行中ストリームの中断用コントローラー（タスクを切り替えても実行は続く） */
const runs = new Map<string, AbortController>();

export function stopAgent(taskId: string) {
  runs.get(taskId)?.abort();
}

/** 許可確認カードのボタンから呼ぶ。サーバー経由で Claude Code に回答を返す */
export async function respondPermission(
  taskId: string,
  requestId: string,
  decision: PermissionDecision,
  alwaysAllow = false,
) {
  await api.respondPermission({ taskId, requestId, decision, alwaysAllow });
}

/** requestId から、その許可確認カードのログを探す */
const findPermissionLog = (taskId: string, requestId: string) =>
  useAppStore.getState().aiLogs[taskId]?.find((l) => l.permission?.requestId === requestId);

/**
 * ユーザーの指示を送り、ストリーミング応答を AI ログに反映する。
 * ツール実行をはさむと、テキスト → ツール → テキスト の順に別々のログとして並べる。
 */
export async function runAgent(taskId: string, message: string, model?: ChatModelId | null) {
  if (runs.has(taskId)) return;
  const controller = new AbortController();
  runs.set(taskId, controller);

  const store = useAppStore.getState;
  store().setTaskRunning(taskId, true);
  store().addAiLog({ taskId, sender: "user", message });

  // 書き込み中のAIテキストログ。空のうちは「考え中…」として表示される
  let currentId: string | null = null;
  let currentHasText = false;
  let completed = false;
  let failed = false;

  const openText = () => {
    currentId = store().addAiLog({ taskId, sender: "ai", message: "", status: "running" });
    currentHasText = false;
  };
  const closeText = () => {
    if (!currentId) return;
    if (currentHasText) store().updateAiLog(taskId, currentId, { status: "done" });
    else store().removeAiLog(taskId, currentId);
    currentId = null;
  };
  const addError = (text: string) =>
    store().addAiLog({ taskId, sender: "ai", message: text, status: "error" });

  openText();
  try {
    await streamChat(
      { taskId, message, ...(model ? { model } : {}) },
      (event) => {
        switch (event.type) {
          case "text":
            if (!currentId) openText();
            store().appendAiLogText(taskId, currentId!, event.text);
            currentHasText = true;
            break;
          case "tool":
            closeText();
            store().addAiLog({
              taskId,
              sender: "ai",
              kind: "tool",
              message: `${event.name}  ${event.summary}`.trim(),
              status: "done",
            });
            openText();
            break;
          case "permission_request":
            // 回答待ちの間は「考え中…」を出さず、カードだけを表示する
            closeText();
            store().addAiLog({
              taskId,
              sender: "ai",
              kind: "permission",
              message: event.summary,
              status: "pending",
              permission: {
                requestId: event.requestId,
                toolName: event.toolName,
                detail: event.detail,
                suggestedRule: event.suggestedRule,
              },
            });
            break;
          case "permission_resolved": {
            const log = findPermissionLog(taskId, event.requestId);
            if (log) {
              store().updateAiLog(taskId, log.id, {
                status: event.decision === "allow" ? "done" : "error",
                permission: {
                  ...log.permission!,
                  decision: event.decision,
                  auto: event.auto,
                  rule: event.rule,
                  remembered: event.remembered,
                },
              });
            }
            openText();
            break;
          }
          case "done":
            closeText();
            completed = true;
            break;
          case "error":
            closeText();
            addError(event.message);
            failed = true;
            break;
        }
      },
      controller.signal,
    );
  } catch (err) {
    closeText();
    failed = true;
    if (controller.signal.aborted) addError("ユーザーが中断しました");
    else addError(err instanceof Error ? err.message : String(err));
  } finally {
    closeText();
    // 中断などで回答されないまま終わったカードは拒否扱いにする（サーバー側も同様に拒否している）
    for (const log of store().aiLogs[taskId] ?? []) {
      if (log.kind === "permission" && log.status === "pending") {
        store().updateAiLog(taskId, log.id, { status: "error", permission: { ...log.permission!, decision: "deny" } });
      }
    }
    runs.delete(taskId);
    store().setTaskRunning(taskId, false);
    // AI の完了を処理キューへ戻す。閲覧済みのタスクでも、回答を見落とさない。
    if (completed) {
      const task = store().tasks.find((item) => item.id === taskId);
      if (task) {
        if (task.status !== "done") store().updateTaskStatus(taskId, "unread");
        if (document.hasFocus()) {
          toast.success(`AIが「${task.title}」を完了しました`);
        } else {
          void notifyOs("PM Hub: AIの作業が完了", task.title);
        }
      }
    } else if (failed) {
      const task = store().tasks.find((item) => item.id === taskId);
      if (task) {
        if (document.hasFocus()) toast.error(`AIが「${task.title}」で停止しました`);
        else void notifyOs("PM Hub: AIの作業が停止", task.title);
      }
    }
  }
}
