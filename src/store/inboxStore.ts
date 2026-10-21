import { create } from "zustand";
import { api } from "../lib/api";
import type { WatchedChat } from "../types";
import { toast } from "./toastStore";
import { useAppStore } from "./useAppStore";

interface InboxState {
  watched: WatchedChat[];
  paused: boolean;
  loaded: boolean;
  lastEventId: number;
  /** サーバーが自動で作ったタスクがあれば、一覧を更新して知らせる */
  poll: () => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  setWatch: (chat: WatchedChat, enabled: boolean) => Promise<void>;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 画面が見えていないときは OS の通知を出す（Tauri のみ） */
async function notifyOs(title: string, body: string) {
  if (!("__TAURI_INTERNALS__" in window)) return;
  try {
    const n = await import("@tauri-apps/plugin-notification");
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === "granted";
    if (granted) n.sendNotification({ title, body });
  } catch {
    // 通知が出せなくても、タスクは一覧に入っているので続ける
  }
}

export const useInboxStore = create<InboxState>((set, get) => ({
  watched: [],
  paused: false,
  loaded: false,
  lastEventId: 0,

  poll: async () => {
    const { loaded, lastEventId } = get();
    const r = await api.inbox(loaded ? lastEventId : undefined).catch(() => null);
    if (!r) return;
    set({ watched: r.watched, paused: r.paused, lastEventId: r.lastEventId, loaded: true });
    if (!loaded || r.events.length === 0) return; // 最初の読み込みでは、通知しない

    void useAppStore.getState().refresh().catch(() => {});
    const added = r.events.filter((e) => e.kind !== "draft");
    if (added.length === 0) return;
    const message = added.length === 1 ? added[0].title : `${added.length} 件の新着メッセージ`;
    const heading = added[0].kind === "created" ? "新しいタスクを追加しました" : "タスクに新着メッセージがあります";
    if (document.hasFocus()) {
      toast.info(`${heading} — ${message}`, { action: { label: "開く", onClick: () => useAppStore.getState().selectTask(added[0].taskId) } });
    } else {
      void notifyOs(heading, message);
    }
  },

  setPaused: async (paused) => {
    set({ paused }); // 先に画面を切り替える
    try {
      const r = await api.inboxPaused(paused);
      set({ watched: r.watched, paused: r.paused });
    } catch (e) {
      set({ paused: !paused });
      toast.error(errorText(e));
    }
  },

  setWatch: async (chat, enabled) => {
    try {
      const r = await api.inboxWatch(chat, enabled);
      set({ watched: r.watched, paused: r.paused });
    } catch (e) {
      toast.error(errorText(e));
    }
  },
}));
