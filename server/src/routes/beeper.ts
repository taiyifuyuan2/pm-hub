import { Router, type Response } from "express";
import { clearBeeperToken, beeperStatus, listChats, readChat, saveBeeperToken } from "../beeper/beeper";
import { messagesRepo, tasksRepo } from "../db/repositories";
import { isTaskId } from "../validation";

export const beeperRouter = Router();

const fail = (res: Response, err: unknown) =>
  res.status(502).json({ error: err instanceof Error ? err.message : String(err) });

beeperRouter.get("/beeper/status", async (_req, res) => res.json(await beeperStatus()));

beeperRouter.put("/beeper/token", (req, res) => {
  const token = req.body?.token;
  if (typeof token !== "string" || !token.trim() || token.length > 2000) return res.status(400).json({ error: "token が不正です" });
  saveBeeperToken(token.trim());
  res.status(204).end();
});

beeperRouter.delete("/beeper/token", (_req, res) => {
  clearBeeperToken();
  res.status(204).end();
});

beeperRouter.get("/beeper/chats", async (req, res) => {
  try {
    res.json(await listChats(typeof req.query.q === "string" ? req.query.q : ""));
  } catch (err) {
    fail(res, err);
  }
});

/** チャットの直近のメッセージを、このタスクのメッセージとして取り込む（取り込み済みは除く） */
beeperRouter.post("/tasks/:taskId/beeper-import", async (req, res) => {
  const { taskId } = req.params;
  const chatID = req.body?.chatID;
  if (!isTaskId(taskId) || typeof chatID !== "string" || !chatID) return res.status(400).json({ error: "パラメータが不正です" });
  if (!tasksRepo.get(taskId)) return res.status(404).json({ error: "タスクが見つかりません" });
  try {
    const { messages } = await readChat(chatID);
    const existing = new Set((messagesRepo.allByTask()[taskId] ?? []).map((m) => `${m.timestamp}|${m.sender}|${m.content}`));
    const added = messages
      .filter((m) => !existing.has(`${m.timestamp}|${m.sender}|${m.content}`))
      .map((m) => messagesRepo.insert({ taskId, ...m }));
    res.status(201).json(added);
  } catch (err) {
    fail(res, err);
  }
});
