const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDateTime = (iso: string) => dateTimeFormatter.format(new Date(iso));

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 「たった今」「5分前」「2時間前」「3日前」。1週間以上前は「10/14」のような日付にする */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  if (diff < MINUTE) return "たった今";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}日前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * 予定日時の表示。「今日 10:00」「明日 10:00」「10/24 10:00」のように、近い日は言葉で表す。
 * overdue は、予定の日時をすぎているか（期限切れの強調に使う）。
 */
export function formatScheduled(iso: string, now: number = Date.now()): { label: string; overdue: boolean } {
  const at = new Date(iso);
  const dayDiff = Math.round((startOfDay(at.getTime()) - startOfDay(now)) / DAY);
  const time = hhmm(at);
  const label =
    dayDiff === 0
      ? `今日 ${time}`
      : dayDiff === 1
        ? `明日 ${time}`
        : dayDiff === -1
          ? `昨日 ${time}`
          : `${at.getMonth() + 1}/${at.getDate()} ${time}`;
  return { label, overdue: at.getTime() < now };
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 「10月21日（水）」 */
export function formatToday(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 同じ日（ローカル時間）か */
export const isSameDay = (iso: string, now: number = Date.now()) => startOfDay(new Date(iso).getTime()) === startOfDay(now);
