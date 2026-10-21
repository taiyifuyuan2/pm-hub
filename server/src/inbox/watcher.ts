import { beeperStatus, recentMessages } from "../beeper/beeper";
import { settingsRepo, suggestionsRepo, watchRepo } from "../db/repositories";
import { generateReply } from "./generator";

const POLL_MS = 15_000;
export const PAUSED_KEY = "inbox.paused";

export const isPaused = () => settingsRepo.get(PAUSED_KEY) === "1";

// 返信案の作成は 1 件ずつ（Claude Code を同時にいくつも起動しない）
let queue: Promise<void> = Promise.resolve();

export function generateFor(suggestionId: string): void {
  queue = queue.then(async () => {
    const s = suggestionsRepo.get(suggestionId);
    if (!s || s.status !== "generating") return;
    try {
      const { messages } = await recentMessages(s.chatID);
      const reply = await generateReply(s.chatTitle, s.network, messages);
      // 作成中にユーザーが捨てた・置き換えられた場合は上書きしない
      if (suggestionsRepo.get(suggestionId)?.status !== "generating") return;
      suggestionsRepo.update(suggestionId, { draft: reply.draft, note: reply.note, status: "pending", error: undefined });
    } catch (err) {
      if (suggestionsRepo.get(suggestionId)?.status === "generating") {
        suggestionsRepo.update(suggestionId, { status: "error", error: err instanceof Error ? err.message : String(err) });
      }
    }
  });
}

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
        const { messages } = await recentMessages(chat.chatID, 5);
        const latest = messages[messages.length - 1];
        if (!latest || latest.timestamp <= chat.lastSeen) continue;
        watchRepo.setLastSeen(chat.chatID, latest.timestamp);
        // いちばん新しいのが相手のメッセージのときだけ（自分がもう返事をしていれば不要）
        if (latest.isSender) continue;
        const s = suggestionsRepo.create({
          chatID: chat.chatID,
          chatTitle: chat.title,
          network: chat.network,
          incoming: latest.text.slice(0, 2000),
          incomingAt: latest.timestamp,
        });
        generateFor(s.id);
      } catch (err) {
        console.error(`[inbox] ${chat.title}:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    ticking = false;
  }
}

export function startInboxWatcher() {
  suggestionsRepo.failInterrupted();
  setInterval(() => void tick(), POLL_MS).unref();
}
