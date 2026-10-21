import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type Phase = "idle" | "counting" | "sending" | "sent";

interface SendWithUndoProps {
  /** 送信先の表示（例: 「岩元大貴」「a@example.com」）。取り消し待ちの間も見せる */
  target: string;
  /** 取り消し時間が過ぎたときに呼ばれる。ここで初めて実際に送信する */
  onSend: () => Promise<void>;
  disabled?: boolean;
  /** 取り消せる時間（ミリ秒） */
  delayMs?: number;
  /** 送信に失敗したとき（トーストなどで知らせる用） */
  onError?: (error: unknown) => void;
  /** 送信できた直後 */
  onSent?: () => void;
  /** 送信済みの状態から始める */
  sent?: boolean;
}

/**
 * 「送信」ボタン。押すと、すぐには送らず、数秒間「取り消す」を出す。
 * 残り時間は細いバーで見せる。時間内に取り消せる / 画面を閉じても送られない。
 * Ctrl+Enter（呼び出し側）や Enter では送信しない。必ずこのボタンを押す。
 */
export function SendWithUndo({ target, onSend, disabled, delayMs = 5000, onError, onSent, sent }: SendWithUndoProps) {
  const [phase, setPhase] = useState<Phase>(sent ? "sent" : "idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current); // 画面を離れたら、送らずに取りやめる
    };
  }, []);

  useEffect(() => {
    if (sent) setPhase("sent");
  }, [sent]);

  const start = () => {
    setPhase("counting");
    timer.current = setTimeout(async () => {
      setPhase("sending");
      try {
        await onSend();
        if (mounted.current) setPhase("sent");
        onSent?.();
      } catch (err) {
        if (mounted.current) setPhase("idle");
        onError?.(err);
      }
    }, delayMs);
  };

  const cancel = () => {
    clearTimeout(timer.current);
    setPhase("idle");
  };

  if (phase === "sent") {
    return (
      <span className="inline-flex animate-pop items-center gap-1.5 rounded-lg bg-new-soft px-3 py-1.5 text-xs font-medium text-new">
        <Icon name="check" size={14} />
        送信しました
      </span>
    );
  }

  if (phase === "counting" || phase === "sending") {
    return (
      <div className="relative inline-flex animate-fade-in items-center gap-2 overflow-hidden rounded-lg border border-line bg-surface py-1.5 pl-3 pr-1.5 text-xs" role="status" aria-live="polite">
        <span className="text-fg">
          {phase === "sending" ? "送信しています…" : `${target} へ送信します`}
        </span>
        <button
          type="button"
          onClick={cancel}
          disabled={phase === "sending"}
          className="rounded-md bg-hover px-2 py-1 font-medium text-fg transition-colors hover:bg-active disabled:opacity-40"
        >
          取り消す
        </button>
        {/* 残り時間: 左から右へ縮むバー */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left animate-countdown bg-ink"
          style={{ animationDuration: `${delayMs}ms` }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      <Icon name="send" size={13} />
      送信
    </button>
  );
}
