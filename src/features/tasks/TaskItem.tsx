import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Icon } from "../../components/Icon";
import { useAppStore } from "../../store/useAppStore";
import type { Task } from "../../types";
import { categoryColorVar } from "../../utils/category";
import { formatRelative, formatScheduled } from "../../utils/format";

interface TaskItemProps {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** スワイプで現れるボタンの幅（px） */
const LEFT_ACTIONS_WIDTH = 76; // 右へスワイプ: 完了
const RIGHT_ACTIONS_WIDTH = 148; // 左へスワイプ: ピン留め・削除
/** この距離（px）以上、横に動いたらスワイプとみなす。クリックと区別する */
const SLOP = 6;
/** 離したとき、この割合以上開いていたら開いたままにする */
const SNAP_RATIO = 0.4;

export function TaskItem({ task, selected, onSelect, onEdit, onDelete }: TaskItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const swipeOpenId = useAppStore((s) => s.swipeOpenId);
  const setSwipeOpen = useAppStore((s) => s.setSwipeOpen);
  const togglePin = useAppStore((s) => s.togglePin);
  const completeTask = useAppStore((s) => s.completeTask);
  const running = useAppStore((s) => s.runningTaskIds.includes(task.id));

  const gesture = useRef<{ id: number; x: number; y: number; base: number; locked: "h" | "v" | null } | null>(null);
  const suppressClick = useRef(false);

  // 自分以外のカードが開いたら閉じる（同時に開くのは1つだけ）
  const isOpen = swipeOpenId === task.id;
  useEffect(() => {
    if (!isOpen) setOffset(0);
  }, [isOpen]);

  // 開いている間は、Esc や外側のクリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setSwipeOpen(null);
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-task-id="${task.id}"]`)) setSwipeOpen(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, task.id, setSwipeOpen]);

  const clamp = (v: number) => Math.max(-RIGHT_ACTIONS_WIDTH, Math.min(LEFT_ACTIONS_WIDTH, v));

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-swipe-ignore]")) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, base: offset, locked: null };
    suppressClick.current = false;
  };

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.locked) {
      // 最初の動きの向きで、横スワイプか縦スクロール（引っ張って更新）かを決める。以後は途中で変えない
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      g.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (g.locked === "h") {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
        setMenuOpen(false);
      }
    }
    if (g.locked !== "h") return;
    suppressClick.current = true;
    setOffset(clamp(g.base + dx));
  };

  const endGesture = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.locked !== "h") return;
    setDragging(false);
    // 十分に開いていれば開いたまま、足りなければ閉じる
    const target =
      offset > LEFT_ACTIONS_WIDTH * SNAP_RATIO
        ? LEFT_ACTIONS_WIDTH
        : offset < -RIGHT_ACTIONS_WIDTH * SNAP_RATIO
          ? -RIGHT_ACTIONS_WIDTH
          : 0;
    setOffset(target);
    setSwipeOpen(target === 0 ? null : task.id);
  };

  const close = () => {
    setOffset(0);
    setSwipeOpen(null);
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    // 開いているときのクリックは、選択ではなく閉じる動作にする
    if (isOpen || offset !== 0) return close();
    onSelect();
  };

  const accent = categoryColorVar(task.category);
  const scheduled = task.scheduledAt ? formatScheduled(task.scheduledAt) : null;
  const unread = task.status === "unread";
  const done = task.status === "done";
  const initial = [...task.title.trim()][0] ?? "?";
  // 開いている側のボタンだけを、キーボードと読み上げの対象にする（隠れている側には触れさせない）
  const leftActionsHidden = offset <= 0; // 右へスワイプしたときだけ開く: 完了
  const rightActionsHidden = offset >= 0; // 左へスワイプしたときだけ開く: ピン留め・削除

  return (
    <div
      data-task-id={task.id}
      className="group/card relative overflow-hidden rounded-lg"
      style={{ ["--cat" as string]: accent } as CSSProperties}
    >
      {/* 右へスワイプしたときに左側に現れる: 完了 */}
      <div className="absolute inset-y-0 left-0 flex" style={{ width: LEFT_ACTIONS_WIDTH }} aria-hidden={leftActionsHidden}>
        <button
          type="button"
          tabIndex={leftActionsHidden ? -1 : 0}
          onClick={() => {
            close();
            completeTask(task.id);
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-new-soft text-xs font-medium text-new"
        >
          <Icon name={done ? "undo" : "check"} size={16} />
          {done ? "再開" : "完了"}
        </button>
      </div>

      {/* 左へスワイプしたときに右側に現れる: ピン留め・削除 */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: RIGHT_ACTIONS_WIDTH }} aria-hidden={rightActionsHidden}>
        <button
          type="button"
          tabIndex={rightActionsHidden ? -1 : 0}
          onClick={() => {
            close();
            togglePin(task.id);
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-info-soft text-xs font-medium text-info"
        >
          <Icon name="pin" size={16} />
          {task.isPinned ? "解除" : "ピン留め"}
        </button>
        <button
          type="button"
          tabIndex={rightActionsHidden ? -1 : 0}
          onClick={() => {
            close();
            onDelete();
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-bad-soft text-xs font-medium text-bad"
        >
          <Icon name="trash" size={16} />
          削除
        </button>
      </div>

      {/* カード本体。スワイプで横に動く */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          touchAction: "pan-y",
        }}
        className="relative"
      >
        <button
          type="button"
          data-task-card
          onClick={handleClick}
          aria-current={selected}
          className={`flex w-full items-start gap-2.5 rounded-lg border py-2.5 pl-2.5 pr-9 text-left transition-colors ${
            selected
              ? "border-line-strong bg-active"
              : unread
                ? "border-transparent bg-new-soft hover:bg-new-soft"
                : "border-transparent bg-sidebar hover:bg-hover"
          }`}
        >
          {/* カテゴリの色のアバター（タイトルの頭文字）。実行中は回転する輪を重ねる */}
          <span
            className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-fg"
            style={{ background: "color-mix(in oklab, var(--cat) 20%, transparent)" }}
            aria-hidden="true"
          >
            {initial}
            {running && <span className="absolute -inset-0.5 animate-spin-slow rounded-[10px] border-2 border-transparent border-t-[color:var(--cat)]" />}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {unread && <span className="size-1.5 shrink-0 rounded-full bg-new" aria-label="未読" />}
              {task.isPinned && <Icon name="pin" size={12} className="shrink-0 text-subtle" aria-label="ピン留め中" role="img" />}
              <span className={`truncate text-sm ${done ? "text-subtle line-through" : "text-fg"} ${unread ? "font-semibold" : "font-medium"}`}>
                {task.title}
              </span>
            </span>
            <span className="mt-1 flex items-center gap-2 text-[11px] text-subtle">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--cat)" }} aria-hidden="true" />
                <span className="truncate">{task.category}</span>
              </span>
              {scheduled ? (
                <span className={`flex shrink-0 items-center gap-1 ${scheduled.overdue && !done ? "font-medium text-bad" : ""}`}>
                  <Icon name={scheduled.overdue && !done ? "alert" : "clock"} size={11} />
                  {scheduled.label}
                </span>
              ) : (
                <span className="shrink-0">{formatRelative(task.createdAt)}</span>
              )}
              {running && <span className="shrink-0 font-medium text-info">実行中</span>}
            </span>
          </span>
        </button>

        {/* マウスで使うための「⋯」メニュー（スワイプを使えない環境の代わりにもなる） */}
        <button
          type="button"
          data-swipe-ignore
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`${task.title} のメニュー`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`absolute right-1.5 top-2 flex size-6 items-center justify-center rounded-md text-subtle hover:bg-active hover:text-fg focus:opacity-100 ${
            menuOpen ? "bg-active opacity-100" : "opacity-0 group-hover/card:opacity-100"
          }`}
        >
          <Icon name="grip" size={14} />
        </button>

        {menuOpen && (
          <TaskMenu
            pinned={task.isPinned}
            done={done}
            onClose={() => setMenuOpen(false)}
            onTogglePin={() => {
              setMenuOpen(false);
              togglePin(task.id);
            }}
            onComplete={() => {
              setMenuOpen(false);
              completeTask(task.id);
            }}
            onEdit={() => {
              setMenuOpen(false);
              onEdit();
            }}
            onDelete={() => {
              setMenuOpen(false);
              onDelete();
            }}
          />
        )}
      </div>
    </div>
  );
}

interface TaskMenuProps {
  pinned: boolean;
  done: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TaskMenu({ pinned, done, onClose, onTogglePin, onComplete, onEdit, onDelete }: TaskMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // メニュー外のクリック / Escape で閉じる。開いたら最初の項目にフォーカスし、↑↓で移動できる
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const itemClass = "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-hover focus:bg-hover focus:outline-none";

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-1 top-9 z-20 w-44 animate-pop overflow-hidden rounded-lg border border-line-strong bg-raised py-1 shadow-pop"
    >
      <button role="menuitem" onClick={onComplete} className={`${itemClass} text-fg`}>
        <Icon name={done ? "undo" : "check"} size={14} />
        {done ? "再開する" : "完了にする"}
      </button>
      <button role="menuitem" onClick={onTogglePin} className={`${itemClass} text-fg`}>
        <Icon name="pin" size={14} />
        {pinned ? "ピン留めを解除" : "ピン留め"}
      </button>
      <button role="menuitem" onClick={onEdit} className={`${itemClass} text-fg`}>
        <Icon name="edit" size={14} />
        編集
      </button>
      <div className="my-1 border-t border-line" />
      <button role="menuitem" onClick={onDelete} className={`${itemClass} text-bad`}>
        <Icon name="trash" size={14} />
        削除
      </button>
    </div>
  );
}
