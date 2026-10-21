import path from "node:path";
import { config } from "../config";
import type { AgentRunner } from "./types";

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/** Claude Code を呼ばずに、ストリーミングと許可確認の流れだけを再現するダミー */
export const runMock: AgentRunner = async ({ taskId, message, emit, requestPermission, signal }) => {
  emit({ type: "start", mode: "mock" });
  await sleep(300, signal);
  emit({ type: "tool", name: "Read", summary: `workspaces/${taskId}/README.md` });

  // ファイル作成の許可を求める（回答があるまで止まる）。実際の CLI と同じく絶対パスで渡す
  const input = { file_path: path.join(config.workspaceRoot, taskId, "notes.md"), content: `# メモ\n\n${message}\n` };
  emit({ type: "tool", name: "Write", summary: input.file_path });
  const decision = await requestPermission({ toolName: "Write", input });
  if (signal.aborted) return;

  const reply =
    decision === "allow"
      ? `（モック応答）notes.md を作成しました。\n> ${message}`
      : "（モック応答）ファイルの作成は拒否されたため、作成せずに終了します。";
  const started = Date.now();
  for (const char of reply) {
    if (signal.aborted) return;
    emit({ type: "text", text: char });
    await sleep(15, signal);
  }
  emit({ type: "done", durationMs: Date.now() - started });
};
