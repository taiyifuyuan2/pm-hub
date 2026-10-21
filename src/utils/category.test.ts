import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORY_COLOR_COUNT, categoryColorIndex, categoryColorVar } from "./category";

describe("categoryColorIndex", () => {
  it("同じ名前は常に同じ番号になる", () => {
    for (const name of ["開発", "企画", "運用", "Dev", "請求書"]) {
      assert.equal(categoryColorIndex(name), categoryColorIndex(name));
    }
  });

  it("番号は 1 ～ 色の数 の範囲に収まる（未分類・空は 0）", () => {
    const names = ["開発", "企画", "運用", "人事", "経理", "Dev", "dev", "AI", "LLP", "YT", "PRE", "Pod", "Life", "😀", "a".repeat(500)];
    for (const name of names) {
      const i = categoryColorIndex(name);
      assert.ok(Number.isInteger(i) && i >= 1 && i <= CATEGORY_COLOR_COUNT, `${name}: ${i}`);
    }
    assert.equal(categoryColorIndex("未分類"), 0);
    assert.equal(categoryColorIndex(""), 0);
    assert.equal(categoryColorIndex("   "), 0);
  });

  it("前後の空白は無視する", () => {
    assert.equal(categoryColorIndex("  開発 "), categoryColorIndex("開発"));
  });

  it("色が1つに偏らない（よく使う名前で複数の色になる）", () => {
    const used = new Set(["開発", "企画", "運用", "人事", "経理", "AI", "Life", "Pod", "YT", "PRE"].map(categoryColorIndex));
    assert.ok(used.size >= 4, `使われた色: ${[...used].join(",")}`);
  });

  it("CSS 変数の参照を返す", () => {
    assert.match(categoryColorVar("開発"), /^var\(--cat-[1-8]\)$/);
    assert.equal(categoryColorVar("未分類"), "var(--cat-0)");
  });
});
