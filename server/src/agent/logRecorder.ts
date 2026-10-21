import type { AgentEvent } from "../../../shared/agent";
import { aiLogsRepo } from "../db/repositories";

/**
 * エージェントのイベントを ai_logs に保存する。
 * 画面側（runAgent.ts）と同じく、テキスト → ツール → テキスト を別々の行として残す。
 * テキストの差分は1行ずつ書かず、区切りのたびにまとめて保存する。
 */
export function createLogRecorder(taskId: string) {
  let text = "";
  /** requestId → 回答待ちの許可確認（回答が確定した時点で1行として保存する） */
  const permissionRequests = new Map<string, Extract<AgentEvent, { type: "permission_request" }>>();

  const flushText = () => {
    const message = text.trim();
    text = "";
    if (message) aiLogsRepo.insert({ taskId, sender: "ai", kind: "text", message, status: "done" });
  };

  return {
    recordUser(message: string) {
      aiLogsRepo.insert({ taskId, sender: "user", kind: "text", message });
    },

    record(event: AgentEvent) {
      switch (event.type) {
        case "text":
          text += event.text;
          break;
        case "tool":
          flushText();
          aiLogsRepo.insert({
            taskId,
            sender: "ai",
            kind: "tool",
            message: `${event.name}  ${event.summary}`.trim(),
            status: "done",
          });
          break;
        case "permission_request":
          flushText();
          permissionRequests.set(event.requestId, event);
          break;
        case "permission_resolved": {
          const request = permissionRequests.get(event.requestId);
          if (!request) break;
          permissionRequests.delete(event.requestId);
          aiLogsRepo.insert({
            taskId,
            sender: "ai",
            kind: "permission",
            message: request.summary,
            status: event.decision === "allow" ? "done" : "error",
            permission: {
              requestId: request.requestId,
              toolName: request.toolName,
              detail: request.detail,
              suggestedRule: request.suggestedRule,
              decision: event.decision,
              auto: event.auto,
              rule: event.rule,
              remembered: event.remembered,
            },
          });
          break;
        }
        case "done":
          flushText();
          break;
        case "error":
          flushText();
          aiLogsRepo.insert({ taskId, sender: "ai", kind: "text", message: event.message, status: "error" });
          break;
      }
    },

    /** 実行終了時に呼ぶ。中断された場合は途中までのテキストと中断の記録を残す */
    finish(aborted: boolean) {
      flushText();
      if (aborted) {
        aiLogsRepo.insert({ taskId, sender: "ai", kind: "text", message: "ユーザーが中断しました", status: "error" });
      }
    },
  };
}
