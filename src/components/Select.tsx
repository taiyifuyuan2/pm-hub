import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** ラベルの下に出す補足 */
  hint?: string;
  /** ラベルの左に出す色の点（CSS の色） */
  dotColor?: string;
  disabled?: boolean;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  /** ボタンの見た目。ghost は枠なし（ヘッダー内など） */
  variant?: "outline" | "ghost";
  size?: "sm" | "md";
  /** 一覧を開く向き。auto は、下に収まらなければ上に開く */
  placement?: "auto" | "top" | "bottom";
  /** 一覧の最小幅（px）。省略するとボタンの幅 */
  menuMinWidth?: number;
  /** 注意を促したい選択（「すべて許可」など）の色づけ */
  tone?: "default" | "warn";
  title?: string;
  className?: string;
  disabled?: boolean;
}

const MENU_MAX_HEIGHT = 288;
const GAP = 6;

/**
 * テーマに合わせた独自のプルダウン（<select> の置き換え）。
 * - キーボード: ↑↓ で移動、Enter / Space で決定、Esc で閉じる、Home / End、文字入力で先頭一致の項目へ
 * - 読み上げ: combobox + listbox のロール、選択中は aria-selected
 * - 一覧は body 直下に描画する（親の overflow: hidden で切れないように）。画面の端では向きを自動で反転する
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  variant = "outline",
  size = "md",
  placement = "auto",
  menuMinWidth,
  tone = "default",
  title,
  className = "",
  disabled = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number; openUp: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", timer: 0 as unknown as ReturnType<typeof setTimeout> });
  const listId = useId();

  const selectedIndex = useMemo(() => Math.max(0, options.findIndex((o) => o.value === value)), [options, value]);
  const selected = options[selectedIndex];

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    close();
  };

  // 開いたときの位置を決める（下に収まらないときは上へ）
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const needed = Math.min(MENU_MAX_HEIGHT, options.length * 36 + 12);
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUp = placement === "top" || (placement === "auto" && spaceBelow < needed && spaceAbove > spaceBelow);
    const minWidth = Math.max(menuMinWidth ?? 0, rect.width);
    // 右にはみ出す場合は、ボタンの右端に合わせる
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - minWidth - 8));
    setPos({ left, top: openUp ? rect.top - GAP : rect.bottom + GAP, minWidth, openUp });
  }, [open, options.length, placement, menuMinWidth]);

  // 外側のクリック、スクロール、画面サイズの変化で閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    const onScrollOrResize = (e: Event) => {
      // 一覧自身のスクロールでは閉じない
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, close]);

  // 選択中の項目が見える位置までスクロールする
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, pos]);

  const move = (delta: number) => {
    // 無効な項目は飛ばす
    let next = activeIndex;
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIndex(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(options.findIndex((o) => !o.disabled));
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1 - [...options].reverse().findIndex((o) => !o.disabled));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        // 文字入力: 先頭が一致する項目へ移動する（連続入力は 0.7 秒以内なら続けて判定）
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const t = typeahead.current;
          clearTimeout(t.timer);
          t.text += e.key.toLowerCase();
          t.timer = setTimeout(() => (t.text = ""), 700);
          const hit = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text));
          if (hit >= 0) setActiveIndex(hit);
        }
    }
  };

  const sizeClass = size === "sm" ? "h-7 px-2 text-xs gap-1" : "h-8 px-2.5 text-sm gap-1.5";
  const variantClass =
    variant === "outline"
      ? "border border-line-strong bg-raised hover:border-subtle"
      : "border border-transparent hover:bg-hover";
  const toneClass = tone === "warn" ? "text-warn" : "text-fg";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={title}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`inline-flex max-w-full items-center justify-between rounded-md transition-colors disabled:opacity-50 ${sizeClass} ${variantClass} ${toneClass} ${className}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {selected?.dotColor && (
            <span className="size-2 shrink-0 rounded-full" style={{ background: selected.dotColor }} aria-hidden="true" />
          )}
          <span className="truncate">{selected?.label}</span>
        </span>
        <Icon
          name="chevronDown"
          size={14}
          className={`shrink-0 text-subtle transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              left: pos.left,
              minWidth: pos.minWidth,
              maxHeight: MENU_MAX_HEIGHT,
              ...(pos.openUp ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            className="z-[70] animate-pop overflow-y-auto rounded-lg border border-line-strong bg-raised p-1 text-sm shadow-pop"
          >
            {options.map((o, i) => {
              const isSelected = i === selectedIndex;
              const isActive = i === activeIndex;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  data-index={i}
                  // フォーカスをボタンに残したまま選べるよう、mousedown でフォーカス移動を止める
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  onMouseMove={() => !o.disabled && setActiveIndex(i)}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${
                    isActive ? "bg-hover" : ""
                  } ${o.disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center text-fg">
                    {isSelected && <Icon name="check" size={14} />}
                  </span>
                  {o.dotColor && <span className="size-2 shrink-0 rounded-full" style={{ background: o.dotColor }} aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{o.label}</span>
                    {o.hint && <span className="block truncate text-[11px] text-subtle">{o.hint}</span>}
                  </span>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
