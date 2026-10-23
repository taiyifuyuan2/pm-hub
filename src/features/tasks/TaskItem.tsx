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
const STATUS_LABELS = { unread: "未読", active: "進行中", scheduled: "予定", done: "完了" } as const;

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
      className={`group/card relative overflow-hidden rounded-xl border transition-colors ${selected ? "border-info bg-info-soft" : "border-line bg-surface hover:border-line-strong"}`}
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
          data-swipe-ignore
          aria-label={`${task.title}を${done ? "再開" : "完了"}する`}
          aria-pressed={done}
          title={done ? "クリックで再開" : "クリックで完了（元に戻せます）"}
          onClick={() => { close(); completeTask(task.id); }}
          className="group/avatar absolute left-2.5 top-2.5 z-10 flex size-11 items-center justify-center rounded-xl border border-transparent text-sm font-semibold text-fg transition-colors hover:border-info hover:bg-info-soft focus-visible:border-info"
          style={{ background: "color-mix(in oklab, var(--cat) 20%, var(--c-surface))" }}
        >
          {done ? <Icon name="check" size={21} className="text-info" /> : <>
            <span className="group-hover/avatar:hidden group-focus-visible/avatar:hidden">{initial}</span>
            <Icon name="check" size={21} className="hidden text-info group-hover/avatar:block group-focus-visible/avatar:block" />
            <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border border-line bg-surface text-info"><Icon name="check" size={10} /></span>
          </>}
          {running && <span aria-hidden="true" className="pointer-events-none absolute -inset-1 animate-breathe rounded-[14px] border-2 border-info" />}
        </button>
        <button
          type="button"
          data-task-card
          onClick={handleClick}
          aria-current={selected}
          className={`flex w-full items-start gap-2.5 rounded-xl py-3 pl-16 pr-14 text-left transition-colors ${
            selected
              ? "bg-info-soft shadow-[inset_3px_0_0_var(--c-info)]"
              : "bg-surface hover:bg-hover"
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-1.5">
              {unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-new" aria-label="未読" />}
              {task.isPinned && <Icon name="pin" size={12} className="mt-1 shrink-0 text-info" aria-label="ピン留め中" role="img" />}
              <span className={`line-clamp-2 break-words text-[13px] leading-5 ${done ? "text-subtle line-through" : "text-fg"} ${selected || unread ? "font-semibold" : "font-medium"}`}>
                {task.title}
              </span>
            </span>
            {task.description && <span className="mt-1 block truncate text-[11px] leading-4 text-muted">{task.description}</span>}
            <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10px] text-subtle">
              <span className="flex min-w-0 max-w-full items-center gap-1 rounded-md bg-hover px-1.5 py-0.5">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--cat)" }} aria-hidden="true" />
                <span className="truncate">{task.category}</span>
              </span>
              {task.project && <span className="max-w-24 truncate rounded-md bg-info-soft px-1.5 py-0.5 text-info">{task.project}</span>}
              {task.assignee && <span className={`rounded-md px-1.5 py-0.5 ${task.assignee === "me" ? "bg-hover text-muted" : task.assignee === "vice" ? "bg-warn-soft text-warn" : "bg-new-soft text-new"}`}>{task.assignee === "me" ? "自分" : task.assignee === "vice" ? "Vice" : "AI"}</span>}
              {task.isPinned && <span>{STATUS_LABELS[task.status]}</span>}
              {scheduled ? (
                <span className={`flex shrink-0 items-center gap-1 ${scheduled.overdue && !done ? "font-medium text-bad" : ""}`}>
                  <Icon name={scheduled.overdue && !done ? "alert" : "clock"} size={11} />
                  {scheduled.label}
                </span>
              ) : (
                <span className="shrink-0">{formatRelative(task.createdAt)}</span>
              )}
              {running && <span className="flex shrink-0 items-center gap-1 font-medium text-info"><Icon name="sparkle" size={11} />AI 実行中</span>}
            </span>
          </span>
        </button>

        {/* 常時見える操作ボタン。メニューはカード内に展開し、一覧の端でも隠れない */}
        <button
          type="button"
          data-swipe-ignore
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`${task.title} のメニュー`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`absolute right-1.5 top-2.5 flex h-8 items-center justify-center gap-0.5 rounded-lg px-1.5 text-[10px] text-subtle hover:bg-active hover:text-fg ${
            menuOpen ? "bg-active text-fg" : ""
          }`}
        >
          操作<Icon name="chevronDown" size={11} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
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

  const itemClass = "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-hover focus:bg-hover focus:outline-none";

  return (
    <div
      ref={ref}
      role="menu"
      data-swipe-ignore
      aria-label="タスクの操作"
      className="relative z-20 grid animate-fade-in grid-cols-2 gap-1 border-t border-line bg-raised p-2"
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
      <button role="menuitem" onClick={onDelete} className={`${itemClass} text-bad`}>
        <Icon name="trash" size={14} />
        削除
      </button>
    </div>
  );
}
