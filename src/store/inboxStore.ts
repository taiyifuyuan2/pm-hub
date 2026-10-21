import { create } from "zustand";
import { api } from "../lib/api";
import type { Suggestion, WatchedChat } from "../types";
import { toast } from "./toastStore";

interface InboxState {
  suggestions: Suggestion[];
  watched: WatchedChat[];
  paused: boolean;
  loaded: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** サーバーの最新の状態を取り込む。新しい返信案が増えていたら知らせる */
  poll: () => Promise<void>;
  send: (id: string, text: string) => Promise<void>;
  putInInput: (id: string, text: string) => Promise<void>;
  regenerate: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  setWatch: (chat: WatchedChat, enabled: boolean) => Promise<void>;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 画面が見えていないときは OS の通知を出す（Tauri のみ）。トーストは画面が見えているとき用 */
async function notifyOs(title: string, body: string) {
  if (!("__TAURI_INTERNALS__" in window)) return;
  try {
    const n = await import("@tauri-apps/plugin-notification");
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === "granted";
    if (granted) n.sendNotification({ title, body });
  } catch {
    // 通知が出せなくても、受信トレイには残るので続ける
  }
}

export const useInboxStore = create<InboxState>((set, get) => {
  const apply = (r: { suggestions: Suggestion[]; watched: WatchedChat[]; paused: boolean }) =>
    set({ suggestions: r.suggestions, watched: r.watched, paused: r.paused, loaded: true });
  const patchOne = (s: Suggestion) =>
    set((st) => ({ suggestions: st.suggestions.map((x) => (x.id === s.id ? s : x)) }));

  return {
    suggestions: [],
    watched: [],
    paused: false,
    loaded: false,
    open: false,
    setOpen: (open) => set({ open }),

    poll: async () => {
      const before = get();
      const known = new Set(before.suggestions.filter((s) => s.status === "pending").map((s) => s.id));
      const r = await api.inbox().catch(() => null);
      if (!r) return;
      apply(r);
      if (!before.loaded) return; // 最初の読み込みでは通知しない
      const fresh = r.suggestions.filter((s) => s.status === "pending" && !known.has(s.id));
      if (fresh.length === 0) return;
      const first = fresh[0];
      const message = fresh.length === 1 ? `${first.chatTitle}: ${first.incoming.slice(0, 40)}` : `${fresh.length} 件の返信案ができました`;
      if (document.hasFocus() && !get().open) {
        toast.info(`返信案ができました — ${message}`, { action: { label: "開く", onClick: () => get().setOpen(true) } });
      } else if (!document.hasFocus()) {
        void notifyOs("返信案ができました", message);
      }
    },

    send: async (id, text) => {
      patchOne(await api.inboxSend(id, text));
    },
    putInInput: async (id, text) => {
      patchOne(await api.inboxDraft(id, text));
    },
    regenerate: async (id) => {
      try {
        patchOne(await api.inboxRegenerate(id));
      } catch (e) {
        toast.error(errorText(e));
      }
    },
    dismiss: async (id) => {
      try {
        patchOne(await api.inboxDismiss(id));
      } catch (e) {
        toast.error(errorText(e));
      }
    },
    setPaused: async (paused) => {
      set({ paused }); // 先に画面を切り替える
      try {
        apply(await api.inboxPaused(paused));
      } catch (e) {
        set({ paused: !paused });
        toast.error(errorText(e));
      }
    },
    setWatch: async (chat, enabled) => {
      try {
        apply(await api.inboxWatch(chat, enabled));
      } catch (e) {
        toast.error(errorText(e));
      }
    },
  };
});
