import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_UI_SETTINGS, sanitizeUiSettings } from "./uiSettings";

describe("sanitizeUiSettings", () => {
  it("正しい値はそのまま復元する", () => {
    const saved = {
      searchQuery: "dev",
      sortBy: "title-asc",
      statusFilter: "active",
      activeContextTab: "messages",
      selectedTaskId: "task-1",
      chatModel: "claude-sonnet-5-5",
      theme: "dark",
      categoryFilter: "開発",
      projectFilter: null,
      leftWidth: 320,
      rightWidth: 400,
      collapsedSections: ["pinned", "done"],
    };
    assert.deepEqual(sanitizeUiSettings(saved), saved);
  });

  it("保存データがない・壊れている場合は既定値を返す", () => {
    for (const raw of [undefined, null, "text", 42, [], true]) {
      assert.deepEqual(sanitizeUiSettings(raw), DEFAULT_UI_SETTINGS, String(raw));
    }
  });

  it("不正な項目だけを既定値に戻し、他の項目は保つ", () => {
    const restored = sanitizeUiSettings({ searchQuery: "ok", sortBy: "bogus", statusFilter: "done", activeContextTab: 7 });
    assert.equal(restored.searchQuery, "ok");
    assert.equal(restored.sortBy, DEFAULT_UI_SETTINGS.sortBy);
    assert.equal(restored.statusFilter, "done");
    assert.equal(restored.activeContextTab, DEFAULT_UI_SETTINGS.activeContextTab);
  });

  it("型が違う検索キーワードは捨てる", () => {
    assert.equal(sanitizeUiSettings({ searchQuery: 123 }).searchQuery, "");
    assert.equal(sanitizeUiSettings({ searchQuery: { a: 1 } }).searchQuery, "");
  });

  it("長すぎる検索キーワードは切り詰める", () => {
    assert.equal(sanitizeUiSettings({ searchQuery: "あ".repeat(5000) }).searchQuery.length, 200);
  });

  it("オブジェクトのプロトタイプ名などは選択肢として受け付けない", () => {
    assert.equal(sanitizeUiSettings({ sortBy: "toString", statusFilter: "constructor" }).sortBy, "created-desc");
    assert.equal(sanitizeUiSettings({ statusFilter: "constructor" }).statusFilter, "all");
  });
});

describe("sanitizeUiSettings: selectedTaskId", () => {
  it("UUID・英数字・ハイフン・アンダースコアの ID は復元する", () => {
    for (const id of ["task-1", "perm_test", "2d5ad59b-bf7b-4e2b-9639-b12abe6b7728"]) {
      assert.equal(sanitizeUiSettings({ selectedTaskId: id }).selectedTaskId, id, id);
    }
  });

  it("null・未保存は null（選択なし）", () => {
    assert.equal(sanitizeUiSettings({ selectedTaskId: null }).selectedTaskId, null);
    assert.equal(sanitizeUiSettings({}).selectedTaskId, null);
  });

  it("ID として不正な値は捨てる（型違い・空・パス風・長すぎる）", () => {
    for (const id of [123, {}, [], "", "../evil", "a/b", "a b", "x".repeat(65)]) {
      assert.equal(sanitizeUiSettings({ selectedTaskId: id }).selectedTaskId, null, JSON.stringify(id));
    }
  });
});

describe("sanitizeUiSettings: chatModel", () => {
  it("許可リストにあるモデルは復元し、未保存は null（既定のモデル）", () => {
    assert.equal(sanitizeUiSettings({ chatModel: "claude-opus-5-5" }).chatModel, "claude-opus-5-5");
    assert.equal(sanitizeUiSettings({ chatModel: "claude-haiku-5-5" }).chatModel, "claude-haiku-5-5");
    assert.equal(sanitizeUiSettings({}).chatModel, null);
  });

  it("許可リストにないモデル（廃止済み・改ざん・型違い）は既定に戻す", () => {
    for (const model of ["claude-3-opus", "gpt-4", "", "--dangerous-flag", 5, {}, "toString"]) {
      assert.equal(sanitizeUiSettings({ chatModel: model }).chatModel, null, JSON.stringify(model));
    }
  });
});

describe("sanitizeUiSettings: 見た目の設定", () => {
  it("テーマは auto / light / dark のみ。不正なら auto", () => {
    for (const t of ["auto", "light", "dark"]) assert.equal(sanitizeUiSettings({ theme: t }).theme, t);
    for (const t of ["blue", "", 1, null, "toString"]) assert.equal(sanitizeUiSettings({ theme: t }).theme, "auto", String(t));
  });

  it("カテゴリの絞り込み: 文字列は復元、空・型違いは null（すべて）", () => {
    assert.equal(sanitizeUiSettings({ categoryFilter: "運用" }).categoryFilter, "運用");
    for (const c of ["", "   ", 5, {}, null]) assert.equal(sanitizeUiSettings({ categoryFilter: c }).categoryFilter, null, String(c));
    assert.equal(sanitizeUiSettings({ categoryFilter: "x".repeat(500) }).categoryFilter?.length, 100);
  });

  it("パネル幅は範囲に収め、数値でなければ既定値", () => {
    assert.equal(sanitizeUiSettings({ leftWidth: 5000 }).leftWidth, 480);
    assert.equal(sanitizeUiSettings({ leftWidth: 1 }).leftWidth, 240);
    assert.equal(sanitizeUiSettings({ rightWidth: "400" }).rightWidth, 340);
    assert.equal(sanitizeUiSettings({ rightWidth: 9999 }).rightWidth, 560);
  });

  it("折りたたみ: 正しい項目だけを重複なく残し、配列でなければ既定（Done を畳む）", () => {
    assert.deepEqual(sanitizeUiSettings({ collapsedSections: ["done", "bogus", "done", "pinned", 3] }).collapsedSections, ["pinned", "done"]);
    assert.deepEqual(sanitizeUiSettings({ collapsedSections: [] }).collapsedSections, []);
    assert.deepEqual(sanitizeUiSettings({ collapsedSections: "done" }).collapsedSections, ["done"]);
    assert.deepEqual(sanitizeUiSettings({}).collapsedSections, ["done"]);
  });
});
