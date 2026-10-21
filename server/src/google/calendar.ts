/** 予定が埋まっている時間帯 */
export interface BusyInterval {
  start: string;
  end: string;
}

// 日本時間（UTC+9）で考える。日本にはサマータイムがないので、固定のずれで計算できる
const JST_OFFSET_MS = 9 * 3600_000;
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

const pad = (n: number) => String(n).padStart(2, "0");

/** 日本時間の「年・月・日・時・分・曜日」に分ける */
function jstParts(ms: number) {
  const d = new Date(ms + JST_OFFSET_MS);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() };
}

/** 日本時間の ymd・時から、その時刻のミリ秒を返す */
const jstMs = (y: number, mo: number, d: number, h: number) => Date.UTC(y, mo - 1, d, h) - JST_OFFSET_MS;

const clock = (ms: number) => {
  const p = jstParts(ms);
  return `${pad(p.h)}:${pad(p.mi)}`;
};

export interface FreeSlotOptions {
  now: number;
  /** 何日先まで（今日を含む） */
  days: number;
  /** 空きとして数える時間帯（日本時間の時）。既定は 9 時から 21 時 */
  dayStartHour?: number;
  dayEndHour?: number;
  /** これより短い空きは載せない（分） */
  minMinutes?: number;
}

/**
 * 予定が埋まっている時間帯から、日ごとの空き時間を作る。
 * 過ぎた時刻は含めない。結果は「10/23(金) 10:00-12:00, 15:00-21:00」のような行のリスト。
 * 予定のない日は「終日空き」とせず、時間帯をそのまま載せる（9:00-21:00）。
 */
export function computeFreeSlots(busy: BusyInterval[], opts: FreeSlotOptions): string[] {
  const { now, days, dayStartHour = 9, dayEndHour = 21, minMinutes = 60 } = opts;
  const intervals = busy
    .map((b) => ({ s: Date.parse(b.start), e: Date.parse(b.end) }))
    .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e) && b.e > b.s)
    .sort((a, b) => a.s - b.s);

  const today = jstParts(now);
  const lines: string[] = [];
  for (let i = 0; i < days; i++) {
    // 日付の計算は、日本時間の正午を基準にして日をずらす（月末・月初をまたいでも安全）
    const base = jstParts(jstMs(today.y, today.mo, today.d, 12) + i * 86_400_000);
    const dayStart = Math.max(jstMs(base.y, base.mo, base.d, dayStartHour), now);
    const dayEnd = jstMs(base.y, base.mo, base.d, dayEndHour);
    if (dayEnd <= dayStart) continue;

    const free: string[] = [];
    let cursor = dayStart;
    const flush = (until: number) => {
      if (until - cursor >= minMinutes * 60_000) free.push(`${clock(cursor)}-${clock(until)}`);
    };
    for (const b of intervals) {
      if (b.e <= cursor) continue;
      if (b.s >= dayEnd) break;
      flush(Math.min(b.s, dayEnd));
      cursor = Math.max(cursor, b.e);
      if (cursor >= dayEnd) break;
    }
    if (cursor < dayEnd) flush(dayEnd);

    const label = `${base.mo}/${base.d}(${DAY_NAMES[base.wd]})`;
    lines.push(`${label} ${free.length > 0 ? free.join(", ") : "空きなし"}`);
  }
  return lines;
}

/** 今の日時を、AI に伝える用の文字列にする（日本時間） */
export function describeNow(now: number): string {
  const p = jstParts(now);
  return `${p.y}年${p.mo}月${p.d}日(${DAY_NAMES[p.wd]}) ${pad(p.h)}:${pad(p.mi)}（日本時間）`;
}
