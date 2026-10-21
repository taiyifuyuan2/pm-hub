import { useEffect, useRef, useState } from "react";

/** 「視覚効果を減らす」の設定か。true なら、アニメーションを省いて最終値をすぐ見せる */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 0 → 1 の進み方。最初は速く、終わりに向かってゆっくり止まる */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * 数字が 0（または前の値）から target まで、滑らかに増えていく値を返す。
 * - target が変わったら、いまの表示値から新しい値へ動く
 * - 視覚効果を減らす設定のときは、動かさずに target をそのまま返す
 * - 整数にしか意味がない数（件数）のために、表示は丸めた値にする
 */
export function useCountUp(target: number, durationMs = 800, delayMs = 0): number {
  const reduced = prefersReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const current = useRef(reduced ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const delta = target - from;
    if (delta === 0) return;
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const step = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / durationMs);
        current.current = from + delta * easeOutCubic(t);
        setValue(current.current);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, delayMs]);

  return Math.round(value);
}
