import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeWorkTimeStats, formatWorkTime } from "./workTime";

describe("computeWorkTimeStats", () => {
  it("カテゴリ別に合計し、計測中の時間も含める", () => {
    const tasks = [{ id: "a", title: "A", description: "", status: "active" as const, category: "開発", createdAt: "2026-10-23T00:00:00.000Z", isPinned: false }];
    const result = computeWorkTimeStats(tasks, { a: { taskId: "a", totalSeconds: 120, runningSince: "2026-10-23T00:00:00.000Z" } }, Date.parse("2026-10-23T00:01:00.000Z"));
    assert.equal(result.totalSeconds, 180);
    assert.equal(result.runningCount, 1);
    assert.deepEqual(result.byCategory, [{ name: "開発", seconds: 180 }]);
  });
  it("時間を読みやすく表示する", () => assert.equal(formatWorkTime(7260), "2時間1分"));
});
