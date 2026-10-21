import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRelative, formatScheduled, formatToday, isSameDay } from "./format";

// 2026-10-21 12:00（ローカル時間）を「現在」とする。タイムゾーンに依存しないよう、ローカル時刻から作る
const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatRelative", () => {
  it("1分未満は「たった今」", () => {
    assert.equal(formatRelative(ago(0), NOW), "たった今");
    assert.equal(formatRelative(ago(59_999), NOW), "たった今");
  });
  it("分・時間・日の境目", () => {
    assert.equal(formatRelative(ago(MIN), NOW), "1分前");
    assert.equal(formatRelative(ago(59 * MIN + 59_000), NOW), "59分前");
    assert.equal(formatRelative(ago(HOUR), NOW), "1時間前");
    assert.equal(formatRelative(ago(23 * HOUR + 59 * MIN), NOW), "23時間前");
    assert.equal(formatRelative(ago(DAY), NOW), "1日前");
    assert.equal(formatRelative(ago(6 * DAY + 23 * HOUR), NOW), "6日前");
  });
  it("1週間以上前は日付", () => {
    assert.equal(formatRelative(new Date(2026, 9, 10, 9, 0).toISOString(), NOW), "10/10");
  });
  it("不正な日付は空文字", () => {
    assert.equal(formatRelative("not-a-date", NOW), "");
  });
  it("未来の日時（時計のずれ）は「たった今」にする", () => {
    assert.equal(formatRelative(new Date(NOW + 5 * MIN).toISOString(), NOW), "たった今");
  });
});

describe("formatScheduled", () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
  it("今日・明日・昨日は言葉で表す", () => {
    assert.deepEqual(formatScheduled(at(21, 15), NOW), { label: "今日 15:00", overdue: false });
    assert.deepEqual(formatScheduled(at(22, 9, 5), NOW), { label: "明日 09:05", overdue: false });
    assert.deepEqual(formatScheduled(at(20, 18), NOW), { label: "昨日 18:00", overdue: true });
  });
  it("それ以外は月/日", () => {
    assert.equal(formatScheduled(at(24, 10), NOW).label, "10/24 10:00");
  });
  it("今日でも時刻をすぎていれば期限切れ", () => {
    assert.equal(formatScheduled(at(21, 9), NOW).overdue, true);
    assert.equal(formatScheduled(at(21, 12, 1), NOW).overdue, false);
  });
  it("日付をまたぐ境目（23:59 と 00:00）で今日/明日が正しく分かれる", () => {
    const lateNow = new Date(2026, 9, 21, 23, 59).getTime();
    assert.equal(formatScheduled(new Date(2026, 9, 22, 0, 0).toISOString(), lateNow).label, "明日 00:00");
    assert.equal(formatScheduled(new Date(2026, 9, 21, 23, 59).toISOString(), lateNow).label, "今日 23:59");
  });
});

describe("formatToday / isSameDay", () => {
  it("月日と曜日", () => {
    assert.equal(formatToday(NOW), "10月21日（水）");
  });
  it("同じ日かどうか（日付が変わる境目）", () => {
    assert.ok(isSameDay(new Date(2026, 9, 21, 0, 0).toISOString(), NOW));
    assert.ok(isSameDay(new Date(2026, 9, 21, 23, 59).toISOString(), NOW));
    assert.ok(!isSameDay(new Date(2026, 9, 20, 23, 59).toISOString(), NOW));
    assert.ok(!isSameDay(new Date(2026, 9, 22, 0, 0).toISOString(), NOW));
  });
});
