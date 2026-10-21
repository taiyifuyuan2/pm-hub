import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clampWidth } from "../../utils/layout";

interface ResizeHandleProps {
  /** 左パネルの右端なら "left"（右へ引くと広がる）、右パネルの左端なら "right"（左へ引くと広がる） */
  side: "left" | "right";
  width: number;
  min: number;
  max: number;
  defaultWidth: number;
  onChange: (width: number) => void;
  label: string;
}

const KEY_STEP = 16;

/**
 * パネルの境界線をドラッグして幅を変える。
 * - マウス・タッチ・ペンに対応。ダブルクリックで既定の幅に戻る
 * - キーボード: 境界線にフォーカスして ←→ で 16px ずつ、Shift で 64px、Home で既定の幅
 * - 幅は min ～ max に収まる
 */
export function ResizeHandle({ side, width, min, max, defaultWidth, onChange, label }: ResizeHandleProps) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const direction = side === "left" ? 1 : -1;

  const set = (value: number) => onChange(clampWidth(value, min, max, defaultWidth));
  // 広げる向きの上限に達していて、これ以上は動かない（ドラッグしても反応しないことを、色で伝える）
  const atLimit = width >= max;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return;
    set(start.current.width + (e.clientX - start.current.x) * direction);
  };
  const end = () => {
    start.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    // 左パネルは → で広がり、右パネルは ← で広がる
    if (e.key === "ArrowRight") set(width + step * direction);
    else if (e.key === "ArrowLeft") set(width - step * direction);
    else if (e.key === "Home") set(defaultWidth);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="ドラッグで幅を変更 / ダブルクリックで元に戻す"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => set(defaultWidth)}
      onKeyDown={onKeyDown}
      // 見た目は1pxの線。つかみやすいよう、当たり判定は左右に広げる
      className="group relative hidden w-px shrink-0 cursor-col-resize touch-none bg-line outline-none lg:block"
    >
      <span
        className={`absolute inset-y-0 -inset-x-1.5 z-20 transition-colors ${
          dragging ? (atLimit ? "bg-warn/30" : "bg-focus/30") : "group-hover:bg-focus/20 group-focus-visible:bg-focus/30"
        }`}
      />
      <span
        className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${
          dragging ? (atLimit ? "bg-warn" : "bg-focus") : "group-hover:bg-focus/60 group-focus-visible:bg-focus"
        }`}
      />
    </div>
  );
}
