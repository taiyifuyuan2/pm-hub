import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { NEXT_THEME } from "./useTheme";

/** 一覧表示用の定義。実際に動くものは下の useGlobalShortcuts で、この一覧と同じ内容を保つ */
export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "タスクを検索" },
  { keys: ["Ctrl", "N"], label: "新規タスクを作成" },
  { keys: ["Alt", "↑ / ↓"], label: "前・次のタスクを選択" },
  { keys: ["Alt", "I"], label: "概要を開く" },
  { keys: ["Alt", "T"], label: "テーマを切り替え" },
  { keys: ["Ctrl", "Enter"], label: "メッセージを送信（入力欄で）" },
  { keys: ["/"], label: "メッセージ入力欄にフォーカス" },
  { keys: ["?"], label: "ショートカット一覧を開く" },
  { keys: ["Esc"], label: "ダイアログ・検索・メニューを閉じる" },
];

/** 文字を入力中か（入力欄では「/」や「?」をそのまま入力できるようにする） */
const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/** アプリ全体のキーボードショートカット。ダイアログが開いている間は、背面の操作になるものは無効にする */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const store = useAppStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const modalOpen = !!document.querySelector("[aria-modal=true]");

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        if (modalOpen) return;
        e.preventDefault();
        const input = document.getElementById("task-search") as HTMLInputElement | null;
        input?.focus();
        input?.select();
        return;
      }
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "n") {
        if (modalOpen) return;
        e.preventDefault();
        store.requestNewTask();
        return;
      }
      if (e.altKey && !mod && e.key.toLowerCase() === "i") {
        if (modalOpen) return;
        e.preventDefault();
        store.setInsightsOpen(true);
        return;
      }
      if (e.altKey && !mod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        store.setTheme(NEXT_THEME[store.theme]);
        return;
      }

      // 文字キー単独のショートカットは、入力中・ダイアログ表示中は動かさない
      if (mod || e.altKey || isTyping(e.target) || modalOpen) return;
      if (e.key === "?") {
        e.preventDefault();
        store.setShortcutsOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("chat-input")?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
