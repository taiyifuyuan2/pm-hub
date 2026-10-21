import { create } from "zustand";

export type ToastKind = "info" | "success" | "error";

export interface ToastAction {
  label: string;
  /** 押されたらトーストを閉じてから呼ばれる */
  onClick: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

interface PushOptions {
  action?: ToastAction;
  /** 表示する時間（ミリ秒）。省略すると種類ごとの既定値 */
  durationMs?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind, options?: PushOptions) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;
/** エラーや、操作ボタン付きのものは、読む・押す時間を長めに取る */
const DURATION_MS: Record<ToastKind, number> = { info: 3200, success: 2800, error: 6500 };
const ACTION_DURATION_MS = 6000;
/** 同時に出す数の上限。あふれたら古いものから消す */
const MAX_TOASTS = 4;

const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, kind = "info", options) => {
    const id = nextId++;
    set((s) => {
      const next = [...s.toasts, { id, kind, message, action: options?.action }];
      // あふれて消えるものの自動消去タイマーも止める
      for (const dropped of next.slice(0, Math.max(0, next.length - MAX_TOASTS))) {
        clearTimeout(timers.get(dropped.id));
        timers.delete(dropped.id);
      }
      return { toasts: next.slice(-MAX_TOASTS) };
    });
    const duration = options?.durationMs ?? (options?.action ? ACTION_DURATION_MS : DURATION_MS[kind]);
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), duration),
    );
    return id;
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** ストア外（api 呼び出しの失敗など）からも使えるショートカット */
export const toast = {
  info: (message: string, options?: PushOptions) => useToastStore.getState().push(message, "info", options),
  success: (message: string, options?: PushOptions) => useToastStore.getState().push(message, "success", options),
  error: (message: string, options?: PushOptions) => useToastStore.getState().push(message, "error", options),
};
