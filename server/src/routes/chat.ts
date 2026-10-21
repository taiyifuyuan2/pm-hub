import { Router } from "express";
import { isChatModelId, type AgentEvent, type ChatRequest, type PermissionResponseRequest } from "../../../shared/agent";
import { runClaude } from "../agent/claudeRunner";
import { createLogRecorder } from "../agent/logRecorder";
import { runMock } from "../agent/mockRunner";
import { createPermissionBroker, resolvePermission } from "../agent/permissions";
import { config } from "../config";
import { tasksRepo } from "../db/repositories";
import { isTaskId } from "../validation";

const MAX_MESSAGE_LENGTH = 20_000;

/** 同じタスクで同時に複数のエージェントを走らせない */
const runningTasks = new Set<string>();
export const isTaskRunning = (taskId: string) => runningTasks.has(taskId);

export const chatRouter = Router();

/**
 * POST /api/chat
 * body: ChatRequest / response: text/event-stream（data: AgentEvent の JSON）
 * やり取りは ai_logs に保存され、次回の /api/bootstrap で復元される。
 */
chatRouter.post("/chat", async (req, res) => {
  const { taskId, message, model } = (req.body ?? {}) as Partial<ChatRequest>;
  if (!isTaskId(taskId)) {
    return res.status(400).json({ error: "taskId が不正です" });
  }
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: "message が空、または長すぎます" });
  }
  if (model !== undefined && !isChatModelId(model)) {
    return res.status(400).json({ error: "model が不正です" });
  }
  if (!tasksRepo.get(taskId)) {
    return res.status(404).json({ error: "タスクが見つかりません" });
  }
  if (runningTasks.has(taskId)) {
    return res.status(409).json({ error: "このタスクのエージェントは実行中です" });
  }

  runningTasks.add(taskId);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  const recorder = createLogRecorder(taskId);
  recorder.recordUser(message);

  const emit = (event: AgentEvent) => {
    recorder.record(event);
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const requestPermission = createPermissionBroker(taskId, emit, abort.signal);
  const run = config.mode === "mock" ? runMock : runClaude;
  try {
    await run({ taskId, message, model, emit, requestPermission, signal: abort.signal });
  } catch (err) {
    emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
  } finally {
    recorder.finish(abort.signal.aborted);
    runningTasks.delete(taskId);
    res.end();
  }
});

/**
 * POST /api/chat/permission
 * 実行中のエージェントからの許可確認（permission_request）に回答する。
 */
chatRouter.post("/chat/permission", (req, res) => {
  const { taskId, requestId, decision, alwaysAllow } = (req.body ?? {}) as Partial<PermissionResponseRequest>;
  if (!isTaskId(taskId) || typeof requestId !== "string") {
    return res.status(400).json({ error: "taskId / requestId が不正です" });
  }
  if (decision !== "allow" && decision !== "deny") {
    return res.status(400).json({ error: "decision は allow か deny を指定してください" });
  }
  if (alwaysAllow !== undefined && typeof alwaysAllow !== "boolean") {
    return res.status(400).json({ error: "alwaysAllow は真偽値で指定してください" });
  }
  if (!resolvePermission(taskId, requestId, decision, { alwaysAllow })) {
    return res.status(404).json({ error: "回答待ちの許可確認が見つかりません（回答済み、または実行が終了しています）" });
  }
  res.status(204).end();
});
