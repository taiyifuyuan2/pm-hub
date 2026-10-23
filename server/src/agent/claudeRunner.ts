import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import type { AgentEvent } from "../../../shared/agent";
import { config } from "../config";
import { rulesRepo, sessionsRepo } from "../db/repositories";
import type { RequestPermission } from "./permissions";
import { writeTaskContext } from "./taskContext";
import { summarizeToolInput } from "./toolSummary";
import type { AgentRunner } from "./types";

const isWindows = process.platform === "win32";
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * Claude Code を SDK と同じ stream-json プロトコルで起動する。
 * - 指示は stdin に JSON で送る（--input-format stream-json）
 * - 許可が必要なツールの実行前に、CLI から control_request(can_use_tool) が届く
 *   （--permission-prompt-tool stdio）。ユーザーの回答を control_response として stdin に返す
 * - 結果（result）を受け取ったら stdin を閉じ、CLI を終了させる
 */
export const runClaude: AgentRunner = async ({ taskId, message, model, emit, requestPermission, signal }) => {
  const cwd = path.join(config.workspaceRoot, taskId);
  await mkdir(cwd, { recursive: true });

  // 2回目以降は保存済みセッションを --resume で継続する（サーバー再起動後も DB から復元される）
  const savedSession = sessionsRepo.get(taskId);
  const knownSession = savedSession && SESSION_ID_PATTERN.test(savedSession) ? savedSession : undefined;
  const args = [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-prompt-tool", "stdio",
  ];
  // model は呼び出し元（routes/chat.ts）が許可リストで検証済みの ID だけ
  if (model) args.push("--model", model);
  if (knownSession) args.push("--resume", knownSession);
  if (config.permissionMode) args.push("--permission-mode", config.permissionMode);

  // 外部 API を含む準備は起動前に終える。起動後に await すると、監視の登録前に
  // CLI が終了して error / close を取り逃がすことがある。
  const hint = await writeTaskContext(taskId, cwd).catch(() => null);
  if (signal.aborted) return;
  const content = hint ? `${hint}\n\n${message}` : message;

  // Windows では claude.cmd を実行するため shell が必要。Node 24 は shell と引数配列の併用を非推奨とするため
  // 1本のコマンド文字列で渡す。引数は固定値と検証済みの値（UUID・許可モード）だけで、ユーザー入力は含まない。
  const child = isWindows
    ? spawn(["claude", ...args].join(" "), { cwd, shell: true, windowsHide: true })
    : spawn("claude", args, { cwd, windowsHide: true });
  const stopOnAbort = () => killTree(child);
  signal.addEventListener("abort", stopOnAbort);

  child.stdin.on("error", () => {}); // CLI が先に終了した場合の EPIPE は close で扱う
  const send = (payload: unknown) => {
    if (child.stdin.writable) child.stdin.write(`${JSON.stringify(payload)}\n`);
  };

  const parser = createStreamJsonParser({
    emit,
    onSession: (sessionId) => sessionsRepo.save(taskId, sessionId),
    onControlRequest: (msg) => void answerControlRequest(msg, requestPermission, send),
    onResult: () => child.stdin.end(),
  });
  createInterface({ input: child.stdout }).on("line", parser.handleLine);

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const completion = new Promise<void>((resolve) => {
    child.on("error", (err: NodeJS.ErrnoException) => {
      emit({
        type: "error",
        message:
          err.code === "ENOENT"
            ? "claude コマンドが見つかりません。Claude Code CLI をインストールするか、PMHUB_AGENT=mock で起動してください。"
            : `Claude Code の起動に失敗しました: ${err.message}`,
      });
      resolve();
    });
    child.on("close", (code) => {
      signal.removeEventListener("abort", stopOnAbort);
      if (signal.aborted) return resolve();
      if (!parser.finished) {
        // Claude Code 側のセッションが消えていると --resume に失敗する。次回は新しい会話で始める
        if (knownSession && !parser.started) {
          sessionsRepo.remove(taskId);
          rulesRepo.clear(taskId); // 「このセッションでは常に許可」は会話と一緒に失効させる
          emit({ type: "error", message: "以前の会話を再開できなかったため、会話履歴をリセットしました。もう一度送信してください。" });
          return resolve();
        }
        emit({
          type: "error",
          message: `Claude Code が終了コード ${code} で終了しました${stderr.trim() ? `:\n${stderr.trim().slice(-2000)}` : ""}`,
        });
      }
      resolve();
    });
  });
  send({ type: "user", message: { role: "user", content }, parent_tool_use_id: null });
  await completion;
};

/** CLI からの control_request に答える。can_use_tool はユーザーの回答を待つ */
async function answerControlRequest(msg: any, requestPermission: RequestPermission, send: (payload: unknown) => void) {
  const request = msg.request ?? {};
  const reply = (response: Record<string, unknown>) =>
    send({ type: "control_response", response: { request_id: msg.request_id, ...response } });

  if (request.subtype !== "can_use_tool") {
    // 未対応の要求には明示的にエラーを返し、CLI を待たせない
    return reply({ subtype: "error", error: `unsupported control request: ${request.subtype}` });
  }

  const decision = await requestPermission({ toolName: request.tool_name, input: request.input });
  reply({
    subtype: "success",
    response:
      decision === "allow"
        ? { behavior: "allow", updatedInput: request.input }
        : { behavior: "deny", message: "ユーザーがこのツールの実行を拒否しました" },
  });
}

/** Windows の shell 経由プロセスは子孫ごと終了させる必要がある */
function killTree(child: ChildProcess) {
  if (child.exitCode !== null || !child.pid) return;
  if (isWindows) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
  else child.kill("SIGTERM");
}

interface ParserHandlers {
  emit: (e: AgentEvent) => void;
  onSession: (sessionId: string) => void;
  onControlRequest: (msg: any) => void;
  onResult: () => void;
}

/**
 * stream-json の1行1JSONを AgentEvent に変換する。
 * テキストは --include-partial-messages の差分（stream_event）から取り、
 * ツール呼び出しは確定した assistant メッセージから取る。
 */
function createStreamJsonParser({ emit, onSession, onControlRequest, onResult }: ParserHandlers) {
  let finished = false;
  let started = false;
  let wroteText = false;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // JSON 以外の出力は無視
    }

    switch (msg.type) {
      case "system":
        if (msg.subtype === "init" && msg.session_id) {
          started = true;
          onSession(msg.session_id);
          emit({ type: "start", mode: "claude", sessionId: msg.session_id });
        }
        break;

      case "stream_event": {
        const ev = msg.event;
        // 複数のテキストブロック（ツール実行をはさむ場合など）は空行で区切る
        if (ev?.type === "content_block_start" && ev.content_block?.type === "text" && wroteText) {
          emit({ type: "text", text: "\n\n" });
        }
        if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
          wroteText = true;
          emit({ type: "text", text: ev.delta.text });
        }
        break;
      }

      case "assistant":
        for (const block of msg.message?.content ?? []) {
          if (block.type === "tool_use") {
            emit({ type: "tool", name: block.name, summary: summarizeToolInput(block.input) });
          }
        }
        break;

      case "control_request":
        onControlRequest(msg);
        break;

      case "result":
        finished = true;
        if (msg.is_error) {
          emit({ type: "error", message: String(msg.result ?? msg.subtype ?? "Claude Code の実行でエラーが発生しました") });
        } else {
          // 差分が来なかった場合（古い CLI など）は最終結果をまとめて流す
          if (!wroteText && msg.result) emit({ type: "text", text: String(msg.result) });
          emit({ type: "done", costUsd: msg.total_cost_usd, durationMs: msg.duration_ms });
        }
        onResult();
        break;
    }
  };

  return {
    handleLine,
    get finished() {
      return finished;
    },
    /** CLI がセッションを開始できたか */
    get started() {
      return started;
    },
  };
}
