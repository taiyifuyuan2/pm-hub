import { useId, useState, type CSSProperties } from "react";
import { Icon } from "../../components/Icon";
import { STATUS_SEGMENTS } from "./statusSegments";
import type { TaskStats } from "./taskStats";
import { foldCategories } from "./taskStats";
import { useCountUp } from "./useCountUp";

/** 棒の太さの上限（px）。スロットいっぱいに広げず、余白を残す */
const MAX_BAR_THICKNESS = 24;

/** マークにホバー・フォーカスしたときに出す、1つだけのツールチップ。値を先頭に、名前を補足にする */
interface Tip {
  title: string;
  value: string;
  /** 目印の色（短い線で示す。塗りつぶしの箱にはしない） */
  color: string;
}

function TooltipBubble({ tip, bottom }: { tip: Tip; bottom?: string }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-raised px-2.5 py-1.5 text-xs shadow-pop"
      style={{ left: "50%", bottom: bottom ?? "calc(100% + 6px)" }}
    >
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: tip.color }} aria-hidden="true" />
        <span className="font-semibold tabular-nums text-fg">{tip.value}</span>
        <span className="text-muted">{tip.title}</span>
      </div>
    </div>
  );
}

/**
 * ホバーとキーボードフォーカスの両方で、同じツールチップを出す枠。
 * 当たり判定は、見た目のマークより大きく取る（呼び出し側が padding を持つ要素として使う）。
 */
function Hit({
  tip,
  children,
  className = "",
  style,
  tipBottom,
}: {
  tip: Tip;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  /** ツールチップの下端の位置（CSS の bottom）。縦棒では、棒の頭の少し上に合わせる */
  tipBottom?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div
      tabIndex={0}
      role="img"
      aria-label={`${tip.title}: ${tip.value}`}
      className={`relative outline-none ${className}`}
      style={style}
      onPointerEnter={() => setShown(true)}
      onPointerLeave={() => setShown(false)}
      onFocus={() => setShown(true)}
      onBlur={() => setShown(false)}
    >
      {children}
      {shown && <TooltipBubble tip={tip} bottom={tipBottom} />}
    </div>
  );
}

/** 大きな数字（ヒーロー）。標準の比例数字で表示し、等幅数字にはしない */
export function HeroFigure({ value, label, sub }: { value: number; label: string; sub: string }) {
  const shown = useCountUp(value, 900);
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-[56px] font-semibold leading-none tracking-tight text-fg" aria-label={`${label} ${value}`}>
        <span aria-hidden="true">{shown}</span>
      </p>
      <p className="mt-2 text-xs text-subtle">{sub}</p>
    </div>
  );
}

/** 数字のタイル（ラベル・値・補足）。期限切れだけは警告色と、アイコン + ラベルで示す */
export function StatTile({
  label,
  value,
  sub,
  delay = 0,
  critical = false,
}: {
  label: string;
  value: number;
  sub?: string;
  delay?: number;
  critical?: boolean;
}) {
  const shown = useCountUp(value, 800, delay);
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {critical && <Icon name="alert" size={13} className="shrink-0" style={{ color: "var(--viz-critical)" }} />}
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-semibold leading-none text-fg" aria-label={`${label} ${value}`}>
        <span aria-hidden="true">{shown}</span>
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-subtle">{sub}</p>}
    </div>
  );
}

/**
 * メーター（完了率）。満たされた部分が左から伸び、空き部分は同じ青の薄い段にする。
 * 割合は 0〜1。数字は直接ラベルとして右に添える。
 */
export function Meter({ ratio, label, detail }: { ratio: number; label: string; detail: string }) {
  const percent = Math.round(ratio * 100);
  const shown = useCountUp(percent, 900);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="text-sm font-semibold text-fg" aria-label={`${label} ${percent}パーセント`}>
          <span aria-hidden="true">{shown}%</span>
        </p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-viz-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <div className="viz-mark h-full origin-left animate-grow-x rounded-full bg-viz-1" style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-subtle">{detail}</p>
    </div>
  );
}

/**
 * ステータスの内訳（積み上げ横棒）。区分は 4 つなので、凡例と直接ラベル（名前・件数・割合）を必ず添える。
 * 区分の間には 2px の隙間（面の色）を空け、枠線は引かない。
 */
export function StatusStack({ stats }: { stats: TaskStats }) {
  const total = stats.total;
  const present = STATUS_SEGMENTS.filter((s) => stats.byStatus[s.key] > 0);
  return (
    <div>
      <div className="flex h-5 gap-0.5" role="group" aria-label="ステータスの内訳">
        {total === 0 ? (
          <div className="h-full flex-1 rounded-md bg-hover" />
        ) : (
          present.map((s, i) => {
            const n = stats.byStatus[s.key];
            const first = i === 0;
            const last = i === present.length - 1;
            return (
              <Hit
                key={s.key}
                tip={{ title: s.label, value: `${n}件（${Math.round((n / total) * 100)}%）`, color: s.color }}
                style={{ flexGrow: n, flexBasis: 0, minWidth: 6 }}
                className="h-full"
              >
                {/* 先頭と末尾だけを丸め、間の区分は四角のまま（基準線側は角を出す） */}
                <span
                  className={`viz-mark block h-full origin-left animate-grow-x ${first ? "rounded-l-md" : ""} ${last ? "rounded-r-md" : ""}`}
                  style={{ background: s.color, animationDelay: `${i * 110}ms` }}
                />
              </Hit>
            );
          })
        )}
      </div>

      {/* 凡例 + 直接ラベル。文字は本文色で、識別は色の点が担う */}
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {STATUS_SEGMENTS.map((s) => {
          const n = stats.byStatus[s.key];
          return (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              <span className="text-muted">{s.label}</span>
              <span className="ml-auto font-semibold tabular-nums text-fg">{n}</span>
              <span className="w-9 text-right tabular-nums text-subtle">{total ? `${Math.round((n / total) * 100)}%` : "–"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * カテゴリ別の件数（横棒）。1 つの系列なので、すべての棒を同じ色（slot 1）にする。
 * 上位だけを出し、残りは「その他」にまとめる。値は棒の先端に置き、基準線（左端）から伸びる。
 */
export function CategoryBars({ stats, limit = 6 }: { stats: TaskStats; limit?: number }) {
  const rows = foldCategories(stats.byCategory, limit);
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-subtle">データがありません</p>;

  return (
    <ul className="space-y-1.5" aria-label="カテゴリ別の件数">
      {rows.map((r, i) => (
        <li key={r.name} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-xs">
          <span className={`truncate text-right ${r.folded ? "text-subtle" : "text-muted"}`} title={r.name}>
            {r.name}
          </span>
          <Hit tip={{ title: r.name, value: `${r.count}件`, color: "var(--viz-1)" }} className="flex h-6 items-center gap-2 py-0.5">
            {/* 棒の太さは 24px まで。左端（基準線）は四角、先端だけ 4px 丸める */}
            <span
              className="viz-mark block origin-left animate-grow-x rounded-r bg-viz-1"
              style={{
                width: `${(r.count / max) * 100}%`,
                minWidth: 4,
                height: MAX_BAR_THICKNESS - 8,
                animationDelay: `${i * 70}ms`,
                // 棒が最大のときも、先端の外側に値を置く場所を残す
                maxWidth: "calc(100% - 1.75rem)",
              }}
            />
            <span className="shrink-0 font-semibold tabular-nums text-fg">{r.count}</span>
          </Hit>
        </li>
      ))}
    </ul>
  );
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 直近14日の作成数（縦棒）。棒は基準線から伸び、4px の丸みは先端だけ。
 * 値のラベルは「最大」と「今日」にだけ付け（全部には付けない）、残りはホバー・フォーカスと表で読める。
 * 目盛りは 0 と最大の 2 本だけの細い実線。
 */
export function DailyColumns({ stats }: { stats: TaskStats }) {
  const days = stats.createdPerDay;
  const max = Math.max(1, ...days.map((d) => d.count));
  const maxIndex = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);
  const plotHeight = 96;
  const descId = useId();
  const nothing = days.every((d) => d.count === 0);

  return (
    <div>
      <p id={descId} className="sr-only">
        直近{days.length}日間の、1日ごとの作成数。最大は{days[maxIndex].count}件です。
      </p>
      <div className="relative" aria-describedby={descId}>
        {/* 目盛りの線（実線の細線）。0 と最大 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2" style={{ height: 0 }}>
          <span className="w-4 text-right text-[10px] tabular-nums text-subtle">{max}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ top: plotHeight }}>
          <span className="w-4 text-right text-[10px] tabular-nums text-subtle">0</span>
          <span className="h-px flex-1 bg-line-strong" />
        </div>

        <div className="ml-6 flex items-end gap-0.5" style={{ height: plotHeight + 20 }}>
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            const height = d.count === 0 ? 0 : Math.max(3, (d.count / max) * (plotHeight - 14));
            const label = `${d.date.getMonth() + 1}/${d.date.getDate()}（${WEEKDAYS[d.date.getDay()]}）`;
            const showValue = d.count > 0 && (i === maxIndex || isToday);
            return (
              <Hit
                key={d.date.getTime()}
                tip={{ title: label, value: `${d.count}件`, color: "var(--viz-1)" }}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                style={{ paddingBottom: 20 }}
                tipBottom={`${20 + height + (showValue ? 16 : 0) + 6}px`}
              >
                {showValue && <span className="mb-0.5 text-[10px] font-semibold tabular-nums text-fg">{d.count}</span>}
                <span
                  className="viz-mark block origin-bottom animate-grow-y rounded-t bg-viz-1"
                  style={{ width: "100%", maxWidth: MAX_BAR_THICKNESS, height, animationDelay: `${i * 35}ms` }}
                />
                <span className={`absolute bottom-0 text-[10px] tabular-nums ${isToday ? "font-semibold text-fg" : "text-subtle"}`}>
                  {i % 2 === (days.length - 1) % 2 ? d.date.getDate() : ""}
                </span>
              </Hit>
            );
          })}
        </div>
      </div>
      {nothing && <p className="mt-1 text-center text-[11px] text-subtle">この期間に作成したタスクはありません</p>}
    </div>
  );
}

/** すべての数字を表で見る。グラフの値を、ホバーなしでも読める形で提供する */
export function DataTables({ stats }: { stats: TaskStats }) {
  const cell = "px-2 py-1.5 text-right tabular-nums";
  const head = "px-2 py-1.5 text-left text-[11px] font-medium text-subtle";
  return (
    <div className="space-y-5 text-xs">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-fg">ステータスの内訳</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className={head}>ステータス</th>
              <th className={`${head} text-right`}>件数</th>
              <th className={`${head} text-right`}>割合</th>
            </tr>
          </thead>
          <tbody>
            {STATUS_SEGMENTS.map((s) => (
              <tr key={s.key} className="border-b border-line/60">
                <td className="px-2 py-1.5 text-muted">{s.label}</td>
                <td className={cell}>{stats.byStatus[s.key]}</td>
                <td className={`${cell} text-subtle`}>{stats.total ? `${Math.round((stats.byStatus[s.key] / stats.total) * 100)}%` : "–"}</td>
              </tr>
            ))}
            <tr>
              <td className="px-2 py-1.5 font-medium text-fg">合計</td>
              <td className={`${cell} font-semibold`}>{stats.total}</td>
              <td className={cell} />
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-fg">カテゴリ別の件数</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className={head}>カテゴリ</th>
              <th className={`${head} text-right`}>件数</th>
            </tr>
          </thead>
          <tbody>
            {stats.byCategory.map((c) => (
              <tr key={c.name} className="border-b border-line/60">
                <td className="px-2 py-1.5 text-muted">{c.name}</td>
                <td className={cell}>{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-fg">直近{stats.createdPerDay.length}日の作成数</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className={head}>日付</th>
              <th className={`${head} text-right`}>作成数</th>
            </tr>
          </thead>
          <tbody>
            {[...stats.createdPerDay].reverse().map((d) => (
              <tr key={d.date.getTime()} className="border-b border-line/60">
                <td className="px-2 py-1.5 text-muted">
                  {d.date.getMonth() + 1}/{d.date.getDate()}（{WEEKDAYS[d.date.getDay()]}）
                </td>
                <td className={cell}>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
