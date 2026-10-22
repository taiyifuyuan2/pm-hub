import { Router, type Response } from "express";
import type { BeeperRecipientInput } from "../../../shared/types";
import { beeperStatus, clearBeeperToken, listChats, readChat, resolveChatRecipient, saveBeeperToken, sendChatMessage, setChatDraft } from "../beeper/beeper";
import { messagesRepo, tasksRepo } from "../db/repositories";
import { isTaskId } from "../validation";

export const beeperRouter = Router();

const fail = (res: Response, err: unknown) =>
  res.status(502).json({ error: err instanceof Error ? err.message : String(err) });

const isRecipientInput = (body: unknown): body is BeeperRecipientInput => {
  if (typeof body !== "object" || body === null) return false;
  const { chat, chatID, network } = body as Record<string, unknown>;
  return typeof chat === "string" && !!chat.trim() && chat.length <= 2000
    && (chatID === undefined || (typeof chatID === "string" && !!chatID.trim() && chatID.length <= 2000))
    && (network === undefined || (typeof network === "string" && network.length <= 2000));
};

/** 操作ボタンを有効にする前に、Beeper が返す宛先を確認する。 */
beeperRouter.post("/beeper/recipient", async (req, res) => {
  if (!isRecipientInput(req.body)) return res.status(400).json({ error: "送信先が不正です" });
  try {
    res.json(await resolveChatRecipient(req.body));
  } catch (err) {
    fail(res, err);
  }
});

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

/** チャットの入力欄に下書きを入れる（送信はしない） */
beeperRouter.post("/beeper/draft", async (req, res) => {
  const text = req.body?.text;
  if (!isRecipientInput(req.body) || typeof text !== "string" || !text.trim() || text.length > 20_000) {
    return res.status(400).json({ error: "chat / text が不正です" });
  }
  try {
    res.status(201).json(await setChatDraft(req.body, text));
  } catch (err) {
    fail(res, err);
  }
});

/** チャット名を指定して送信する。画面で「送信」を押された（取り消し時間が過ぎた）ときだけ呼ばれる */
beeperRouter.post("/beeper/send", async (req, res) => {
  const text = req.body?.text;
  if (!isRecipientInput(req.body) || typeof text !== "string" || !text.trim() || text.length > 20_000) {
    return res.status(400).json({ error: "chat / text が不正です" });
  }
  try {
    res.status(201).json(await sendChatMessage(req.body, text));
  } catch (err) {
    fail(res, err);
  }
});
