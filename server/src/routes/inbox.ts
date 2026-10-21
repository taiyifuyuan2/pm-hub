import { Router } from "express";
import type { InboxResponse } from "../../../shared/types";
import { settingsRepo, watchRepo } from "../db/repositories";
import { eventsAfter, isPaused, lastEventId, PAUSED_KEY } from "../inbox/watcher";

export const inboxRouter = Router();

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 2000;

const snapshot = (after = lastEventId()): InboxResponse => ({
  events: eventsAfter(after),
  lastEventId: lastEventId(),
  watched: watchRepo.list().map(({ chatID, title, network }) => ({ chatID, title, network })),
  paused: isPaused(),
});

/** GET /api/inbox?after=<イベント番号> — 見張っているチャットと、その番号より後に自動で作られたタスク */
inboxRouter.get("/inbox", (req, res) => {
  const after = Number(req.query.after);
  res.json(snapshot(Number.isFinite(after) ? after : lastEventId()));
});

/** 新着メッセージの自動タスク化を、一時停止 / 再開する */
inboxRouter.put("/inbox/paused", (req, res) => {
  if (typeof req.body?.paused !== "boolean") return res.status(400).json({ error: "paused が不正です" });
  settingsRepo.set(PAUSED_KEY, req.body.paused ? "1" : "0");
  res.json(snapshot());
});

/** チャットごとに、新着の自動タスク化を ON / OFF する。ON にした時点より前のメッセージは対象外 */
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
