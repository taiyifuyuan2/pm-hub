import { Router, type Response } from "express";
import { beeperStatus, clearBeeperToken, findChatByTitle, listChats, readChat, saveBeeperToken, sendChatMessage, setChatDraft, setChatDraftById } from "../beeper/beeper";
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

/** チャットの入力欄に下書きを入れる（送信はしない） */
beeperRouter.post("/beeper/draft", async (req, res) => {
  const { chat, chatID, text } = req.body ?? {};
  const hasId = typeof chatID === "string" && chatID.trim().length > 0;
  if ((!hasId && (typeof chat !== "string" || !chat.trim())) || typeof text !== "string" || !text.trim() || text.length > 20_000) {
    return res.status(400).json({ error: "chat / text が不正です" });
  }
  try {
    res.status(201).json(hasId ? await setChatDraftById(chatID, text) : await setChatDraft(chat, text));
  } catch (err) {
    fail(res, err);
  }
});

/** チャット名を指定して送信する。画面で「送信」を押された（取り消し時間が過ぎた）ときだけ呼ばれる */
beeperRouter.post("/beeper/send", async (req, res) => {
  const { chat, chatID, text } = req.body ?? {};
  const hasId = typeof chatID === "string" && chatID.trim().length > 0;
  if ((!hasId && (typeof chat !== "string" || !chat.trim())) || typeof text !== "string" || !text.trim() || text.length > 20_000) {
    return res.status(400).json({ error: "chat / text が不正です" });
  }
  try {
    // ID があればそれを使う（同じ名前のチャットが複数あっても、別の人に届かない）
    const target = hasId ? { id: chatID as string, title: typeof chat === "string" ? chat : "", network: "" } : await findChatByTitle(chat);
    await sendChatMessage(target.id, text);
    res.status(201).json({ chatTitle: target.title, network: target.network });
  } catch (err) {
    fail(res, err);
  }
});
