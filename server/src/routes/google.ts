import { Router, type Response } from "express";
import { messagesRepo, tasksRepo } from "../db/repositories";
import {
  createDraft,
  finishLogin,
  googleLogout,
  googleStatus,
  readThread,
  searchThreads,
  startLogin,
} from "../google/google";
import { isTaskId } from "../validation";

export const googleRouter = Router();

const fail = (res: Response, err: unknown, status = 502) =>
  res.status(status).json({ error: err instanceof Error ? err.message : String(err) });

googleRouter.get("/google/status", (_req, res) => res.json(googleStatus()));

/** ログイン用の URL を返す。画面側が既定のブラウザで開く */
googleRouter.post("/google/login", (_req, res) => {
  try {
    res.json({ url: startLogin() });
  } catch (err) {
    fail(res, err, 400);
  }
});

/** Google からのリダイレクト先。ブラウザに結果のページを返す */
googleRouter.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const page = (title: string, body: string) =>
    res
      .type("html")
      .send(`<!doctype html><meta charset="utf-8"><title>PM Hub</title><body style="font-family:sans-serif;padding:3rem"><h2>${title}</h2><p>${body}</p>`);
  if (typeof code !== "string" || typeof state !== "string") {
    return page("ログインできませんでした", typeof error === "string" ? "許可されませんでした。" : "不正なリクエストです。");
  }
  try {
    await finishLogin(code, state);
    page("ログインしました", "このウィンドウを閉じて、PM Hub に戻ってください。");
  } catch (err) {
    page("ログインできませんでした", "PM Hub に戻って、もう一度お試しください。");
    console.error("[google] login failed:", err);
  }
});

googleRouter.post("/google/logout", (_req, res) => {
  googleLogout();
  res.status(204).end();
});

googleRouter.get("/gmail/threads", async (req, res) => {
  try {
    res.json(await searchThreads(typeof req.query.q === "string" ? req.query.q : ""));
  } catch (err) {
    fail(res, err);
  }
});

/** スレッドの全メッセージを、このタスクのメッセージとして取り込む（取り込み済みの重複は除く） */
googleRouter.post("/tasks/:taskId/gmail-import", async (req, res) => {
  const { taskId } = req.params;
  const threadId = req.body?.threadId;
  if (!isTaskId(taskId) || typeof threadId !== "string") return res.status(400).json({ error: "パラメータが不正です" });
  if (!tasksRepo.get(taskId)) return res.status(404).json({ error: "タスクが見つかりません" });
  try {
    const { subject, messages } = await readThread(threadId);
    const existing = new Set((messagesRepo.allByTask()[taskId] ?? []).map((m) => `${m.timestamp}|${m.sender}`));
    const added = messages
      .filter((m) => !existing.has(`${m.timestamp}|${m.sender || "(不明)"}`))
      .map((m) =>
        messagesRepo.insert({
          taskId,
          source: "email",
          sender: m.sender || "(不明)",
          content: `【${subject}】\n${m.content}`.slice(0, 20_000),
          timestamp: m.timestamp,
        }),
      );
    res.status(201).json(added);
  } catch (err) {
    fail(res, err);
  }
});

googleRouter.post("/gmail/drafts", async (req, res) => {
  const { to, subject, body, threadId } = req.body ?? {};
  if (typeof to !== "string" || !to.trim() || typeof subject !== "string" || typeof body !== "string") {
    return res.status(400).json({ error: "to / subject / body が必要です" });
  }
  try {
    res
      .status(201)
      .json(await createDraft({ to: to.trim(), subject, body, threadId: typeof threadId === "string" ? threadId : undefined }));
  } catch (err) {
    fail(res, err);
  }
});
