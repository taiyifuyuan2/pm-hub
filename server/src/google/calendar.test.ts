import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeFreeSlots, describeNow } from "./calendar";

// 2026-10-23（金）08:00 JST = 2026-10-22T23:00:00Z
const NOW = Date.parse("2026-10-22T23:00:00Z");
const jst = (md: string, hm: string) => `2026-${md}T${hm}:00+09:00`;

describe("computeFreeSlots", () => {
  it("予定がなければ 9:00-21:00 がそのまま空き", () => {
    assert.deepEqual(computeFreeSlots([], { now: NOW, days: 1 }), ["10/23(金) 09:00-21:00"]);
  });

  it("予定の前後が空きになり、予定の時間は除かれる", () => {
    const busy = [{ start: jst("10-23", "10:00"), end: jst("10-23", "11:30") }, { start: jst("10-23", "14:00"), end: jst("10-23", "15:00") }];
    assert.deepEqual(computeFreeSlots(busy, { now: NOW, days: 1 }), ["10/23(金) 09:00-10:00, 11:30-14:00, 15:00-21:00"]);
  });

  it("重なる予定・日をまたぐ予定も正しく扱う", () => {
    const busy = [
      { start: jst("10-23", "09:00"), end: jst("10-23", "13:00") },
      { start: jst("10-23", "12:00"), end: jst("10-24", "10:00") }, // 翌日の午前まで
    ];
    assert.deepEqual(computeFreeSlots(busy, { now: NOW, days: 2 }), ["10/23(金) 空きなし", "10/24(土) 10:00-21:00"]);
  });

  it("過ぎた時刻は空きに含めない", () => {
    const noon = Date.parse("2026-10-23T03:00:00Z"); // 12:00 JST
    assert.deepEqual(computeFreeSlots([], { now: noon, days: 1 }), ["10/23(金) 12:00-21:00"]);
  });

  it("短すぎる空き（1時間未満）は載せない", () => {
    const busy = [{ start: jst("10-23", "09:30"), end: jst("10-23", "21:00") }];
    assert.deepEqual(computeFreeSlots(busy, { now: NOW, days: 1 }), ["10/23(金) 空きなし"]);
  });

  it("月をまたいでも日付が正しい", () => {
    const lines = computeFreeSlots([], { now: Date.parse("2026-10-30T23:00:00Z"), days: 3 });
    assert.deepEqual(lines.map((l) => l.split(" ")[0]), ["10/31(土)", "11/1(日)", "11/2(月)"]);
  });
});

describe("describeNow", () => {
  it("日本時間の日付・曜日・時刻にする", () => {
    assert.equal(describeNow(NOW), "2026年10月23日(金) 08:00（日本時間）");
  });
});
