// フロントエンド（src/）とローカルサーバー（server/）で共有する通信プロトコル
import type { AiLog, Memo, MessageThread, PermissionDecision, PermissionRule, Task } from "./types";

/**
 * チャットで選べるモデル。id は Claude Code CLI の --model にそのまま渡す。
 * 画面（選択肢の表示）とサーバー（許可リストによる検証）で共有する。
 */
export const CHAT_MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5" },
] as const;
export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];
export const isChatModelId = (value: unknown): value is ChatModelId => CHAT_MODELS.some((m) => m.id === value);

export interface ChatRequest {
  taskId: string;
  message: string;
  /** 省略すると Claude Code の既定のモデルを使う */
  model?: ChatModelId;
}

/** PUT /api/tasks/:id/permission-mode — manual: 毎回確認 / allow-all: このセッション中はすべて許可 */
export type PermissionMode = "manual" | "allow-all";

export type AgentMode = "claude" | "mock";

/** POST /api/chat のレスポンス（SSE）で流れるイベント */
export type AgentEvent =
  | { type: "start"; mode: AgentMode; sessionId?: string }
  /** AI応答テキストの差分。受信側で追記していく */
  | { type: "text"; text: string }
  /** エージェントがツールを使った（ファイル読み込み・コマンド実行など） */
  | { type: "tool"; name: string; summary: string }
  /** エージェントが許可の必要なツール（ファイル編集・コマンド実行など）を使おうとしている。回答するまで処理は止まる */
  | {
      type: "permission_request";
      requestId: string;
      toolName: string;
      summary: string;
      detail?: string;
      /** 「このセッションでは常に許可」で登録されるルール。登録できない操作では undefined */
      suggestedRule?: string;
    }
  /** 許可確認への回答が確定した（ユーザーの回答、ルールによる自動許可、または中断による自動拒否） */
  | {
      type: "permission_resolved";
      requestId: string;
      decision: PermissionDecision;
      auto?: boolean;
      rule?: string;
      remembered?: boolean;
    }
  | { type: "done"; costUsd?: number; durationMs?: number }
  | { type: "error"; message: string };

/** POST /api/chat/permission */
export interface PermissionResponseRequest {
  taskId: string;
  requestId: string;
  decision: PermissionDecision;
  /** 許可する場合に、同種の操作をこのセッションでは常に許可するルールを登録する */
  alwaysAllow?: boolean;
}

/** GET /api/permissions/rules[?taskId=] */
export interface PermissionRulesResponse {
  rules: PermissionRule[];
}

export interface HealthResponse {
  ok: true;
  mode: AgentMode;
  workspaceRoot: string;
  dbPath: string;
}

/** GET /api/bootstrap — 起動時に画面へ渡す全データ */
export interface BootstrapResponse {
  tasks: Task[];
  memos: Record<string, Memo>;
  aiLogs: Record<string, AiLog[]>;
  messages: Record<string, MessageThread[]>;
}
