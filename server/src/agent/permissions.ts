import { randomUUID } from "node:crypto";
import type { AgentEvent } from "../../../shared/agent";
import type { PermissionDecision } from "../../../shared/types";
import { rulesRepo } from "../db/repositories";
import { deriveRule, matchesRule, ruleLabel, type ToolInput } from "./permissionRules";
import { describeToolInput, summarizeToolInput } from "./toolSummary";

export interface PermissionRequest {
  toolName: string;
  input: ToolInput;
}

/** エージェントの実行を止めて、ユーザーの回答を待つ関数 */
export type RequestPermission = (req: PermissionRequest) => Promise<PermissionDecision>;

interface Pending {
  taskId: string;
  resolve: (decision: PermissionDecision, options?: { alwaysAllow?: boolean }) => void;
}

/** requestId → 回答待ちの許可確認 */
const pending = new Map<string, Pending>();

/**
 * 1回の実行（POST /api/chat）用の許可確認窓口を作る。
 * 1. このタスクに登録済みの「常に許可」ルールに合致すれば、確認せずに許可する（自動許可）
 * 2. そうでなければ画面へ permission_request を送り、POST /api/chat/permission で回答が来るまで待つ
 * 実行が中断されたら、未回答の確認はすべて拒否として扱う。
 */
export function createPermissionBroker(
  taskId: string,
  emit: (event: AgentEvent) => void,
  signal: AbortSignal,
): RequestPermission {
  return ({ toolName, input }) =>
    new Promise<PermissionDecision>((resolve) => {
      if (signal.aborted) return resolve("deny");
      const requestId = randomUUID();
      const summary = summarizeToolInput(input);
      const detail = describeToolInput(toolName, input);
      const suggested = deriveRule(toolName, input);

      // ルールは確認のたびに DB から読む（解除やセッションのリセットがすぐ反映される）
      const matched = rulesRepo.list(taskId).find((rule) => matchesRule(rule, toolName, input));
      if (matched) {
        // 履歴に残すため、確認カード → 自動許可の順にイベントを流す
        emit({ type: "permission_request", requestId, toolName, summary, detail });
        emit({ type: "permission_resolved", requestId, decision: "allow", auto: true, rule: ruleLabel(matched) });
        return resolve("allow");
      }

      const settle = (decision: PermissionDecision, options?: { alwaysAllow?: boolean }) => {
        if (!pending.delete(requestId)) return; // 回答済み
        signal.removeEventListener("abort", onAbort);

        // 保存するルールは、画面から送られた値ではなくサーバーが保持している要求内容から導く
        let rule: string | undefined;
        if (decision === "allow" && options?.alwaysAllow && suggested) {
          rulesRepo.add(taskId, suggested);
          rule = ruleLabel(suggested);
        }
        emit({ type: "permission_resolved", requestId, decision, ...(rule ? { rule, remembered: true } : {}) });
        resolve(decision);
      };
      const onAbort = () => settle("deny");

      pending.set(requestId, { taskId, resolve: settle });
      signal.addEventListener("abort", onAbort);
      emit({
        type: "permission_request",
        requestId,
        toolName,
        summary,
        detail,
        suggestedRule: suggested ? ruleLabel(suggested) : undefined,
      });
    });
}

/** 画面からの回答を、待っている実行に渡す。該当する確認がなければ false */
export function resolvePermission(
  taskId: string,
  requestId: string,
  decision: PermissionDecision,
  options?: { alwaysAllow?: boolean },
): boolean {
  const entry = pending.get(requestId);
  if (!entry || entry.taskId !== taskId) return false;
  entry.resolve(decision, options);
  return true;
}
