import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
}

/** 更新が始まる引っ張りの距離（px）と、引っ張れる上限 */
const THRESHOLD = 64;
const MAX_PULL = 110;
/** 指（ポインター）の動きに対して、表示が動く割合。引くほど重くなる感触にする */
const RESISTANCE = 0.5;
/** この距離（px）以上、縦に動いたら引っ張りの開始とみなす（クリックや横スワイプと区別する） */
const START_SLOP = 6;
/** トラックパッドなどのホイール操作: この量（px）を上方向に溜めたら更新する。操作が止まったら 250ms でリセット */
const WHEEL_TRIGGER = 140;
const WHEEL_RESET_MS = 250;

type Phase = "idle" | "pulling" | "ready" | "refreshing" | "done";

const DRAG_CONTROLS = "input, textarea, select, [data-no-pull]";

/**
 * 引っ張って更新（pull to refresh）。スクロール位置が一番上のときに、下へ引っ張る / 上へ勢いよくスクロールすると更新する。
 * - タッチ・ペン・マウスのどれでも、一覧のどこからでも下へドラッグできる（入力欄などの上を除く）。
 *   カードの上からでも、最初の動きが縦なら引っ張り、横なら（カードの）スワイプ、動かなければクリックになる
 * - 更新中は、一覧を消さずに少し薄くする（スケルトンに戻すとちらつくため）
 * - 視覚効果を減らす設定でも、機能自体（引っ張る→更新）は使える。動きだけが省かれる
 */
export function PullToRefresh({ onRefresh, children, className = "" }: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const drag = useRef<{ id: number; startY: number; startX: number; active: boolean } | null>(null);
  const wheel = useRef({ sum: 0, timer: 0 as unknown as ReturnType<typeof setTimeout> });

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const run = useCallback(async () => {
    setPhaseBoth("refreshing");
    setPull(THRESHOLD * 0.7);
    try {
      await onRefresh();
      setPhaseBoth("done");
    } catch {
      // エラーのトーストは呼び出し側（refresh）が出す。ここでは通常の状態に戻すだけ
      setPhaseBoth("idle");
    }
    // 「更新しました」を少し見せてから閉じる
    setTimeout(() => {
      setPull(0);
      setPhaseBoth("idle");
    }, 700);
  }, [onRefresh]);

  const atTop = () => (scrollRef.current?.scrollTop ?? 1) <= 0;

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current === "refreshing" || !atTop()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest(DRAG_CONTROLS)) return;
    drag.current = { id: e.pointerId, startY: e.clientY, startX: e.clientX, active: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    const dx = e.clientX - d.startX;
    if (!d.active) {
      // 横方向の動き（スワイプ）や、上方向の動き（通常のスクロール）のときは、引っ張りにしない
      if (Math.abs(dx) > Math.abs(dy) || dy < -START_SLOP) {
        drag.current = null;
        return;
      }
      if (dy < START_SLOP || !atTop()) return;
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const amount = Math.min(MAX_PULL, Math.max(0, dy - START_SLOP) * RESISTANCE);
    setPull(amount);
    setPhaseBoth(amount >= THRESHOLD ? "ready" : "pulling");
  };

  const finishDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    if (phaseRef.current === "ready") void run();
    else {
      setPull(0);
      setPhaseBoth("idle");
    }
  };

  // トラックパッドやマウスホイール: 一番上でさらに上へスクロールしようとした量を溜める
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (phaseRef.current === "refreshing" || e.deltaY >= 0 || el.scrollTop > 0) {
        wheel.current.sum = 0;
        return;
      }
      clearTimeout(wheel.current.timer);
      wheel.current.sum += -e.deltaY;
      wheel.current.timer = setTimeout(() => {
        wheel.current.sum = 0;
        if (phaseRef.current === "pulling" || phaseRef.current === "ready") {
          setPull(0);
          setPhaseBoth("idle");
        }
      }, WHEEL_RESET_MS);
      const amount = Math.min(MAX_PULL, (wheel.current.sum / WHEEL_TRIGGER) * THRESHOLD);
      setPull(amount);
      setPhaseBoth(amount >= THRESHOLD ? "ready" : "pulling");
      if (amount >= THRESHOLD) {
        wheel.current.sum = 0;
        clearTimeout(wheel.current.timer);
        void run();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(wheel.current.timer);
    };
  }, [run]);

  const label =
    phase === "refreshing" ? "更新中…" : phase === "done" ? "更新しました" : phase === "ready" ? "離して更新" : "引っ張って更新";
  const progress = Math.min(1, pull / THRESHOLD);
  const dragging = phase === "pulling" || phase === "ready";

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col ${className}`}>
      {/* 引っ張ると、上から出てくる表示 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-end justify-center overflow-hidden"
        style={{ height: pull, transition: dragging ? "none" : "height 220ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        role="status"
        aria-live="polite"
      >
        {pull > 4 && (
          <div className="mb-2 flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-xs text-muted shadow-sm ring-1 ring-line">
            {phase === "refreshing" ? (
              <Icon name="refresh" size={13} className="animate-spin-slow" />
            ) : phase === "done" ? (
              <Icon name="check" size={13} className="text-new" />
            ) : (
              <Icon
                name="arrowDown"
                size={13}
                className="transition-transform duration-150"
                style={{ transform: `rotate(${phase === "ready" ? 180 : progress * 160}deg)` }}
              />
            )}
            <span>{label}</span>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        // 縦のスクロールはブラウザに任せ、引っ張りだけを自前で扱う（タッチの横スワイプも妨げない）
        style={{
          transform: pull ? `translateY(${pull}px)` : undefined,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          touchAction: "pan-y",
          overscrollBehaviorY: "contain",
        }}
        className={`min-h-0 flex-1 overflow-y-auto transition-opacity duration-200 ${phase === "refreshing" ? "opacity-60" : ""}`}
        aria-busy={phase === "refreshing"}
      >
        {children}
      </div>
    </div>
  );
}
