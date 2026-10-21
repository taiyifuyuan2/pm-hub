import { Router, type Response } from "express";
import type { InboxResponse } from "../../../shared/types";
import { sendChatMessage, setChatDraftById } from "../beeper/beeper";
import { settingsRepo, suggestionsRepo, watchRepo } from "../db/repositories";
import { generateFor, isPaused, PAUSED_KEY } from "../inbox/watcher";

export const inboxRouter = Router();

const fail = (res: Response, err: unknown, status = 502) =>
  res.status(status).json({ error: err instanceof Error ? err.message : String(err) });

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 20_000;

const snapshot = (): InboxResponse => ({
  suggestions: suggestionsRepo.list(),
  watched: watchRepo.list().map(({ chatID, title, network }) => ({ chatID, title, network })),
  paused: isPaused(),
});

inboxRouter.get("/inbox", (_req, res) => res.json(snapshot()));

/** 自動の返信案づくりを、一時停止 / 再開する */
inboxRouter.put("/inbox/paused", (req, res) => {
  if (typeof req.body?.paused !== "boolean") return res.status(400).json({ error: "paused が不正です" });
  settingsRepo.set(PAUSED_KEY, req.body.paused ? "1" : "0");
  res.json(snapshot());
});

/** チャットごとに、自動の返信案づくりを ON / OFF する。ON にした時点より前のメッセージは対象外 */
inboxRouter.put("/inbox/watch", (req, res) => {
  const { chatID, title, network, enabled } = req.body ?? {};
  if (!isText(chatID) || typeof enabled !== "boolean") return res.status(400).json({ error: "パラメータが不正です" });
  if (enabled) {
    if (!isText(title) || !isText(network)) return res.status(400).json({ error: "title / network が必要です" });
    watchRepo.add({ chatID, title, network });
  } else {
    watchRepo.remove(chatID);
  }
  res.json(snapshot());
});

/** 返信案を実際に送信する。画面で「送信」を押された（取り消し時間が過ぎた）ときだけ呼ばれる */
inboxRouter.post("/inbox/:id/send", async (req, res) => {
  const s = suggestionsRepo.get(req.params.id);
  if (!s) return res.status(404).json({ error: "返信案が見つかりません" });
  if (s.status === "sent") return res.status(409).json({ error: "すでに送信済みです" });
  if (!isText(req.body?.text)) return res.status(400).json({ error: "text が不正です" });
  try {
    await sendChatMessage(s.chatID, req.body.text);
    res.json(suggestionsRepo.update(s.id, { draft: req.body.text, status: "sent", error: undefined }));
  } catch (err) {
    fail(res, err);
  }
});

/** 送信せず、相手とのチャットの入力欄に入れる */
inboxRouter.post("/inbox/:id/draft", async (req, res) => {
  const s = suggestionsRepo.get(req.params.id);
  if (!s) return res.status(404).json({ error: "返信案が見つかりません" });
  if (!isText(req.body?.text)) return res.status(400).json({ error: "text が不正です" });
  try {
    await setChatDraftById(s.chatID, req.body.text);
    res.json(suggestionsRepo.update(s.id, { draft: req.body.text }));
  } catch (err) {
    fail(res, err);
  }
});

inboxRouter.post("/inbox/:id/regenerate", (req, res) => {
  const s = suggestionsRepo.get(req.params.id);
  if (!s) return res.status(404).json({ error: "返信案が見つかりません" });
  if (s.status === "sent") return res.status(409).json({ error: "送信済みの案は作り直せません" });
  const next = suggestionsRepo.update(s.id, { draft: "", note: undefined, status: "generating", error: undefined });
  generateFor(s.id);
  res.json(next);
});

inboxRouter.post("/inbox/:id/dismiss", (req, res) => {
  const s = suggestionsRepo.get(req.params.id);
  if (!s) return res.status(404).json({ error: "返信案が見つかりません" });
  res.json(suggestionsRepo.update(s.id, { status: "dismissed" }));
});

/** 編集した文面を保存する（送信前の下書きとして残す） */
inboxRouter.put("/inbox/:id/text", (req, res) => {
  const s = suggestionsRepo.get(req.params.id);
  if (!s) return res.status(404).json({ error: "返信案が見つかりません" });
  if (typeof req.body?.text !== "string" || req.body.text.length > 20_000) return res.status(400).json({ error: "text が不正です" });
  res.json(suggestionsRepo.update(s.id, { draft: req.body.text }));
});
