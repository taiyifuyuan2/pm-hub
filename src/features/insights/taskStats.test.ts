import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Task } from "../../types";
import { computeTaskStats, foldCategories } from "./taskStats";

// 2026-10-21 12:00（ローカル時間）を「現在」とする
const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime();
const at = (day: number, hour = 9, month = 9) => new Date(2026, month, day, hour).toISOString();

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: "",
  status: "active",
  category: "開発",
  createdAt: at(21),
  isPinned: false,
  ...overrides,
});

describe("computeTaskStats: 件数", () => {
  const tasks = [
    task("a", { status: "unread" }),
    task("b", { status: "active" }),
    task("c", { status: "active" }),
    task("d", { status: "scheduled", scheduledAt: at(25) }),
    task("e", { status: "done" }),
  ];
  const s = computeTaskStats(tasks, NOW);

  it("ステータス別・合計・未完了", () => {
    assert.deepEqual(s.byStatus, { unread: 1, active: 2, scheduled: 1, done: 1 });
    assert.equal(s.total, 5);
    assert.equal(s.open, 4);
  });
  it("完了率は 完了 / 全体", () => {
    assert.equal(s.completionRate, 0.2);
  });
  it("タスクが0件でも壊れない（完了率は 0、NaN にならない）", () => {
    const empty = computeTaskStats([], NOW);
    assert.equal(empty.total, 0);
    assert.equal(empty.completionRate, 0);
    assert.equal(empty.open, 0);
    assert.deepEqual(empty.byCategory, []);
    assert.equal(empty.createdPerDay.length, 14);
    assert.ok(empty.createdPerDay.every((d) => d.count === 0));
  });
});

describe("computeTaskStats: 期限切れ", () => {
  it("予定をすぎた未完了タスクだけを数える", () => {
    const s = computeTaskStats(
      [
        task("past-active", { status: "active", scheduledAt: at(20) }),
        task("past-scheduled", { status: "scheduled", scheduledAt: at(21, 9) }),
        task("future", { status: "scheduled", scheduledAt: at(22) }),
        task("past-done", { status: "done", scheduledAt: at(10) }),
        task("no-schedule", { status: "active" }),
      ],
      NOW,
    );
    assert.equal(s.overdue, 2);
  });
  it("ちょうど今の時刻の予定は、まだ期限切れではない", () => {
    assert.equal(computeTaskStats([task("x", { scheduledAt: new Date(NOW).toISOString() })], NOW).overdue, 0);
  });
});

describe("computeTaskStats: 直近の作成数", () => {
  it("14日分が、古い日から今日の順に並ぶ", () => {
    const s = computeTaskStats([], NOW);
    assert.equal(s.createdPerDay.length, 14);
    assert.equal(s.createdPerDay[13].date.getDate(), 21);
    assert.equal(s.createdPerDay[0].date.getDate(), 8);
  });
  it("日付で数える（今日の0:00 と 23:59 は今日、前日の23:59 は昨日）", () => {
    const s = computeTaskStats(
      [
        task("t1", { createdAt: new Date(2026, 9, 21, 0, 0).toISOString() }),
        task("t2", { createdAt: new Date(2026, 9, 21, 23, 59).toISOString() }),
        task("y1", { createdAt: new Date(2026, 9, 20, 23, 59).toISOString() }),
      ],
      NOW,
    );
    assert.equal(s.createdPerDay[13].count, 2);
    assert.equal(s.createdPerDay[12].count, 1);
  });
  it("14日より前や不正な日付は数えない", () => {
    const s = computeTaskStats([task("old", { createdAt: at(1) }), task("bad", { createdAt: "invalid" })], NOW);
    assert.equal(s.createdPerDay.reduce((n, d) => n + d.count, 0), 0);
  });
  it("今週の新規は直近7日（今日を含む）", () => {
    const s = computeTaskStats(
      [task("today", { createdAt: at(21) }), task("6d", { createdAt: at(15) }), task("7d", { createdAt: at(14) })],
      NOW,
    );
    assert.equal(s.createdThisWeek, 2);
  });
  it("月をまたぐ日付も正しく並ぶ", () => {
    const s = computeTaskStats([], new Date(2026, 10, 3, 12).getTime());
    assert.deepEqual(s.createdPerDay.slice(-5).map((d) => `${d.date.getMonth() + 1}/${d.date.getDate()}`), ["10/30", "10/31", "11/1", "11/2", "11/3"]);
  });
});

describe("computeTaskStats: カテゴリ", () => {
  it("件数の多い順、同数は名前順", () => {
    const s = computeTaskStats([task("1", { category: "運用" }), task("2", { category: "開発" }), task("3", { category: "開発" }), task("4", { category: "企画" })], NOW);
    assert.deepEqual(s.byCategory.map((c) => `${c.name}:${c.count}`), ["開発:2", "企画:1", "運用:1"].sort((a, b) => Number(b.split(":")[1]) - Number(a.split(":")[1]) || a.localeCompare(b, "ja")));
    assert.equal(s.byCategory[0].name, "開発");
  });
});

describe("foldCategories", () => {
  const cats = [5, 4, 3, 2, 1, 1, 1].map((count, i) => ({ name: `c${i}`, count }));
  it("上限以下ならそのまま", () => {
    assert.deepEqual(foldCategories(cats.slice(0, 4), 4), cats.slice(0, 4));
  });
  it("上限を超えたら、残りを「その他」にまとめる（合計は変わらない）", () => {
    const folded = foldCategories(cats, 5);
    assert.equal(folded.length, 5);
    // 先頭4件（5, 4, 3, 2）を残し、5件目以降（1, 1, 1）を「その他」にまとめる
    assert.deepEqual(folded[4], { name: "その他", count: 3, folded: true });
    assert.equal(folded.reduce((n, c) => n + c.count, 0), cats.reduce((n, c) => n + c.count, 0));
  });
});
