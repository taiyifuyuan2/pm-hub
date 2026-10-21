import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

interface ModalProps {
  onClose: () => void;
  /** ダイアログの見出しを指す id（読み上げ用）。title を渡した場合は不要 */
  labelledBy?: string;
  /** 見出し。渡すと、見出しと閉じるボタンを持つ標準のヘッダーを出す */
  title?: string;
  /** 見出しの上に出す内容（パンくずなど） */
  eyebrow?: ReactNode;
  children: ReactNode;
  /** フォームとして送信する場合に指定する（Enter で送信できる） */
  onSubmit?: () => void;
  width?: string;
}

/** 開いているモーダルの積み重なり。一番上のものだけが Esc とフォーカスの巡回を扱う */
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * モーダルダイアログ。
 * - 背景のクリック / Esc で閉じる（重なっているときは一番上だけ）
 * - フォーカスを内側に閉じ込め（Tab が外に出ない）、閉じたら元の場所へ戻す
 * - 開いている間は、背面のスクロールを止める
 * - 狭い画面（スマホ幅）では、画面の下から出るシートになる
 */
export function Modal({ onClose, labelledBy, title, eyebrow, children, onSubmit, width = "max-w-md" }: ModalProps) {
  const id = useRef(Symbol("modal")).current;
  const panelRef = useRef<HTMLDivElement>(null);
  const autoTitleId = useId();
  const headingId = title ? autoTitleId : labelledBy;
  // 背景を押した（mousedown）場所が背景自身のときだけ閉じる。内側で選択を始めて背景で離したときに閉じないように
  const downOnBackdrop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    stack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    // 最初のフォーカス: autofocus があればそれ、なければ最初の入力、なければパネル自身
    const initial =
      panel?.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ??
      panel?.querySelector<HTMLElement>("input, textarea, select") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    (initial ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return; // 一番上のモーダルだけが処理する
      if (e.key === "Escape") {
        // プルダウンが開いているときの Esc は、プルダウン側が閉じる
        if (e.defaultPrevented) return;
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panel) {
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      document.body.style.overflow = previousOverflow;
      // 閉じたら、開く前にいた場所へフォーカスを戻す（まだ画面にある場合だけ）
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [id]);

  const panelClass = `relative flex max-h-[88vh] w-full ${width} animate-sheet flex-col overflow-hidden rounded-t-2xl border border-line-strong bg-raised text-fg shadow-pop outline-none sm:rounded-2xl`;

  const header = title ? (
    <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs text-subtle">{eyebrow}</div>}
        <h2 id={headingId} className="text-base font-semibold leading-snug">
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-1.5 text-subtle hover:bg-hover hover:text-fg"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  ) : null;

  const content = (
    <>
      {header}
      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-5 ${title ? "pb-5 pt-3" : "py-5"}`}>{children}</div>
    </>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-start sm:p-4 sm:pt-[10vh]"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
    >
      {onSubmit ? (
        <form
          ref={panelRef as unknown as React.RefObject<HTMLFormElement>}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          tabIndex={-1}
          className={panelClass}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {content}
        </form>
      ) : (
        <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1} className={panelClass}>
          {content}
        </div>
      )}
    </div>,
    document.body,
  );
}

export const buttonClass = {
  primary:
    "rounded-lg bg-ink px-4 py-2 text-sm font-medium text-on-ink transition-opacity hover:opacity-90 disabled:opacity-40",
  danger:
    "rounded-lg bg-bad px-4 py-2 text-sm font-medium text-on-ink transition-opacity hover:opacity-90 disabled:opacity-40",
  ghost: "rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-fg",
};
