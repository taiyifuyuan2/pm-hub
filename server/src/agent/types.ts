import type { AgentEvent } from "../../../shared/agent";
import type { RequestPermission } from "./permissions";

export interface RunOptions {
  taskId: string;
  message: string;
  /** 使用するモデル（許可リスト検証済み）。省略時は Claude Code の既定 */
  model?: string;
  /** イベントを受け取るコールバック */
  emit: (event: AgentEvent) => void;
  /** 許可が必要なツールを使う前に呼び、ユーザーの回答を待つ */
  requestPermission: RequestPermission;
  /** クライアント切断時などに中断する */
  signal: AbortSignal;
}

/** 実行が終わったら resolve する（成功・失敗とも emit で通知済み） */
export type AgentRunner = (options: RunOptions) => Promise<void>;
