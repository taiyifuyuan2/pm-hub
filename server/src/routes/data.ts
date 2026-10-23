import { Router } from "express";
import type { BootstrapResponse } from "../../../shared/agent";
import { aiLogsRepo, memosRepo, messagesRepo, taskTimesRepo, tasksRepo } from "../db/repositories";
import { isTaskRunning } from "./chat";
import { isMemoContent, isTaskId, parseNewMessage, parseNewTask, parseTaskPatch } from "../validation";

export const dataRouter = Router();

/** GET /api/bootstrap — 画面の初期化に必要な全データ */
dataRouter.get("/bootstrap", (_req, res) => {
  const body: BootstrapResponse = {
    tasks: tasksRepo.list(),
    memos: memosRepo.all(),
    aiLogs: aiLogsRepo.allByTask(),
    messages: messagesRepo.allByTask(),
    taskTimes: taskTimesRepo.all(),
  };
  res.json(body);
});

dataRouter.put("/tasks/:id/timer", (req, res) => {
  const { id } = req.params;
  if (!isTaskId(id)) return res.status(400).json({ error: "id が不正です" });
  if (!tasksRepo.get(id)) return res.status(404).json({ error: "タスクが見つかりません" });
  if (typeof req.body?.running !== "boolean") return res.status(400).json({ error: "running は真偽値にしてください" });
  res.json(req.body.running ? taskTimesRepo.start(id) : taskTimesRepo.stop(id));
});

/** POST /api/tasks */
dataRouter.post("/tasks", (req, res) => {
  const task = parseNewTask(req.body);
  if (typeof task === "string") return res.status(400).json({ error: task });
  if (tasksRepo.get(task.id)) return res.status(409).json({ error: "同じ id のタスクが既にあります" });
  res.status(201).json(tasksRepo.insert(task));
});

/** PATCH /api/tasks/:id */
dataRouter.patch("/tasks/:id", (req, res) => {
  if (!isTaskId(req.params.id)) return res.status(400).json({ error: "id が不正です" });
  const patch = parseTaskPatch(req.body);
  if (typeof patch === "string") return res.status(400).json({ error: patch });
  const task = tasksRepo.update(req.params.id, patch);
  if (!task) return res.status(404).json({ error: "タスクが見つかりません" });
  res.json(task);
});

/**
 * DELETE /api/tasks/:id — 関連するメモ・AIログ・セッション・メッセージも削除する。
 * 作業ディレクトリ（~/.pm-hub/workspaces/<id>）はエージェントが作ったファイルを含むため残す。
 */
dataRouter.delete("/tasks/:id", (req, res) => {
  if (!isTaskId(req.params.id)) return res.status(400).json({ error: "id が不正です" });
  if (isTaskRunning(req.params.id)) return res.status(409).json({ error: "エージェントの実行中は削除できません" });
  if (!tasksRepo.remove(req.params.id)) return res.status(404).json({ error: "タスクが見つかりません" });
  res.status(204).end();
});

/** PUT /api/memos/:taskId — メモを丸ごと保存する */
dataRouter.put("/memos/:taskId", (req, res) => {
  const { taskId } = req.params;
  if (!isTaskId(taskId)) return res.status(400).json({ error: "taskId が不正です" });
  if (!isMemoContent(req.body?.content)) return res.status(400).json({ error: "content が不正です" });
  if (!tasksRepo.get(taskId)) return res.status(404).json({ error: "タスクが見つかりません" });
  res.json(memosRepo.save(taskId, req.body.content));
});

/** POST /api/tasks/:taskId/messages — メッセージを1件追加する（手入力・外部連携の取り込み共通） */
dataRouter.post("/tasks/:taskId/messages", (req, res) => {
  const { taskId } = req.params;
  if (!isTaskId(taskId)) return res.status(400).json({ error: "taskId が不正です" });
  const message = parseNewMessage(req.body);
  if (typeof message === "string") return res.status(400).json({ error: message });
  if (!tasksRepo.get(taskId)) return res.status(404).json({ error: "タスクが見つかりません" });
  res.status(201).json(messagesRepo.insert({ taskId, ...message }));
});

/** DELETE /api/tasks/:taskId/messages/:id */
dataRouter.delete("/tasks/:taskId/messages/:id", (req, res) => {
  const { taskId, id } = req.params;
  if (!isTaskId(taskId) || typeof id !== "string") return res.status(400).json({ error: "id が不正です" });
  if (!messagesRepo.remove(taskId, id)) return res.status(404).json({ error: "メッセージが見つかりません" });
  res.status(204).end();
});
