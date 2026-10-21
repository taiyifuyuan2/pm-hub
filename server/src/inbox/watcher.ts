import { randomUUID } from "node:crypto";
import type { AutoTaskEvent, MessageSource, Task } from "../../../shared/types";
import { beeperStatus, recentMessages, type RecentMessage } from "../beeper/beeper";
import { aiLogsRepo, messagesRepo, settingsRepo, tasksRepo, watchRepo } from "../db/repositories";
import { getFreeSlots } from "../google/google";
import { generateReply } from "./generator";

const POLL_MS = 15_000;
export const PAUSED_KEY = "inbox.paused";

export const isPaused = () => settingsRepo.get(PAUSED_KEY) === "1";

// ---------- 画面に知らせるためのイベント ----------

const events: AutoTaskEvent[] = [];
let nextEventId = 1;

function pushEvent(kind: AutoTaskEvent["kind"], task: Task) {
  events.push({ id: nextEventId++, kind, taskId: task.id, title: task.title });
  if (events.length > 50) events.shift();
}

export const eventsAfter = (after: number) => events.filter((e) => e.id > after);
export const lastEventId = () => nextEventId - 1;

// ---------- 新着 → タスク ----------

const sourceOf = (network: string): MessageSource => (/line/i.test(network) ? "line" : "beeper");
const FENCE = "```";

function replyMessage(chatTitle: string, chatID: string, draft: string, note?: string): string {
  if (!draft) {
    return `返信案は作れませんでした。確認が必要です: ${note ?? "内容を決められません"}\n\nこのチャットに返す内容を教えてもらえれば、返信案を作ります。`;
  }
  const block = `${FENCE}beeper-draft\nchat: ${chatTitle}\nid: ${chatID}\n---\n${draft}\n${FENCE}`;
  return `返信案を作りました。内容を確認して、よければ「送信」を押してください（押してから 5 秒は取り消せます）。\n\n${block}${note ? `\n\n補足: ${note}` : ""}`;
}

/** 相手の新着メッセージを、タスクにする。同じチャットの続きは、開いているタスクに足す */
async function processIncoming(chat: { chatID: string; title: string; network: string; taskId: string | null }, history: RecentMessage[]) {
  const latest = history[history.length - 1];
  const existing = chat.taskId ? tasksRepo.get(chat.taskId) : undefined;

  let task: Task;
  let kind: AutoTaskEvent["kind"];
  if (existing && existing.status !== "done") {
    task = tasksRepo.update(existing.id, { status: "unread" }) ?? existing;
    kind = "updated";
  } else {
    task = tasksRepo.insert({
      id: randomUUID(),
      title: `${chat.title}: ${latest.text.replace(/\s+/g, " ").slice(0, 30)}`,
      description: `${chat.network} の「${chat.title}」から新着メッセージ:\n\n${latest.text.slice(0, 2000)}`,
      status: "unread",
      category: "返信",
      createdAt: new Date().toISOString(),
      isPinned: false,
    });
    watchRepo.setTask(chat.chatID, task.id);
    kind = "created";
  }

  // やり取りを、メッセージタブに入れる（取り込み済みの分は除く）
  const source = sourceOf(chat.network);
  const known = new Set((messagesRepo.allByTask()[task.id] ?? []).map((m) => `${m.timestamp}|${m.sender}|${m.content}`));
  for (const m of history) {
    const content = `【${chat.title}】\n${m.text}`.slice(0, 20_000);
    if (known.has(`${m.timestamp}|${m.sender}|${content}`)) continue;
    messagesRepo.insert({ taskId: task.id, source, sender: m.sender, content, timestamp: m.timestamp });
  }
  pushEvent(kind, task); // タスクは先に見せて、返信案はできしだい足す

  try {
    let availability: string | null = null;
    try {
      availability = await getFreeSlots();
    } catch (err) {
      console.error("[inbox] カレンダーを読めませんでした:", err instanceof Error ? err.message : err);
    }
    const reply = await generateReply(chat.title, chat.network, history, availability);
    aiLogsRepo.insert({ taskId: task.id, sender: "ai", kind: "text", message: replyMessage(chat.title, chat.chatID, reply.draft, reply.note) });
  } catch (err) {
    aiLogsRepo.insert({
      taskId: task.id,
      sender: "ai",
      kind: "text",
      message: `返信案を作れませんでした（${err instanceof Error ? err.message : String(err)}）。チャットで「返信案を作って」と頼むと、もう一度作れます。`,
    });
  }
  pushEvent("draft", task);
}

// 返信案の作成は 1 件ずつ（Claude Code を同時にいくつも起動しない）
let queue: Promise<void> = Promise.resolve();

let ticking = false;

/** 見張っているチャットに、相手の新しいメッセージが来ていないか確認する */
async function tick() {
  if (ticking || isPaused()) return;
  const watched = watchRepo.list();
  if (watched.length === 0) return;
  ticking = true;
  try {
    if (!(await beeperStatus()).valid) return; // Beeper が起動していない・トークンがない間は何もしない
    for (const chat of watched) {
      try {
        const { messages } = await recentMessages(chat.chatID, 15);
        const latest = messages[messages.length - 1];
        if (!latest || latest.timestamp <= chat.lastSeen) continue;
        watchRepo.setLastSeen(chat.chatID, latest.timestamp);
        // いちばん新しいのが相手のメッセージのときだけ（自分がもう返事をしていれば不要）
        if (latest.isSender) continue;
        queue = queue.then(() =>
          processIncoming(chat, messages).catch((err) => console.error(`[inbox] ${chat.title}:`, err instanceof Error ? err.message : err)),
        );
      } catch (err) {
        console.error(`[inbox] ${chat.title}:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    ticking = false;
  }
}

export function startInboxWatcher() {
  setInterval(() => void tick(), POLL_MS).unref();
}
