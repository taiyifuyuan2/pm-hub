import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Task } from "../../types";
import { filterAndSortTasks, groupTasksForList, listCategories, matchesQuery } from "./filterTasks";

const task = (id: string, overrides: Partial<Task>): Task => ({
  id,
  title: id,
  description: "",
  status: "active",
  category: "開発",
  createdAt: "2026-10-01T00:00:00Z",
  isPinned: false,
  ...overrides,
});

const tasks: Task[] = [
  task("a", { title: "Login バグ調査", category: "開発", createdAt: "2026-10-03T00:00:00Z", status: "active" }),
  task("b", { title: "ロードマップ作成", category: "企画", createdAt: "2026-10-01T00:00:00Z", status: "active", scheduledAt: "2026-10-30T00:00:00Z" }),
  task("c", { title: "週次定例", category: "運用", createdAt: "2026-10-02T00:00:00Z", status: "scheduled", scheduledAt: "2026-10-25T00:00:00Z" }),
  task("d", { title: "AI 機能の設計", category: "Dev", createdAt: "2026-10-04T00:00:00Z", status: "done" }),
];

const ids = (list: Task[]) => list.map((t) => t.id).join(",");
const all = { status: "all", query: "", sortBy: "created-desc" } as const;

describe("matchesQuery", () => {
  it("大文字小文字を区別しない", () => {
    assert.ok(matchesQuery(tasks[0], "LOGIN"));
    assert.ok(matchesQuery(tasks[3], "dev")); // カテゴリ
  });
  it("全角・半角の違いを無視する", () => {
    assert.ok(matchesQuery(tasks[0], "ｌｏｇｉｎ"));
    assert.ok(matchesQuery(tasks[3], "ＡＩ"));
  });
  it("タイトルとカテゴリの両方を対象にする", () => {
    assert.ok(matchesQuery(tasks[1], "ロードマップ"));
    assert.ok(matchesQuery(tasks[1], "企画"));
    assert.ok(!matchesQuery(tasks[1], "運用"));
  });
  it("空・空白だけのキーワードはすべて一致する", () => {
    assert.ok(matchesQuery(tasks[0], ""));
    assert.ok(matchesQuery(tasks[0], "   "));
  });
  it("説明文は検索対象にしない", () => {
    assert.ok(!matchesQuery({ ...tasks[0], description: "秘密のキーワード" }, "秘密"));
  });
});

describe("filterAndSortTasks: 並べ替え", () => {
  it("作成日が新しい順 / 古い順", () => {
    assert.equal(ids(filterAndSortTasks(tasks, all)), "d,a,c,b");
    assert.equal(ids(filterAndSortTasks(tasks, { ...all, sortBy: "created-asc" })), "b,c,a,d");
  });
  it("予定日が近い順（未設定は末尾）", () => {
    // c(10/25) → b(10/30) → 未設定の a, d は作成日の新しい順
    assert.equal(ids(filterAndSortTasks(tasks, { ...all, sortBy: "scheduled-asc" })), "c,b,d,a");
  });
  it("タイトル順", () => {
    const sorted = filterAndSortTasks(tasks, { ...all, sortBy: "title-asc" });
    assert.deepEqual(sorted.map((t) => t.title), [...tasks.map((t) => t.title)].sort((x, y) => x.localeCompare(y, "ja")));
  });
  it("元の配列を変更しない", () => {
    const before = ids(tasks);
    filterAndSortTasks(tasks, { ...all, sortBy: "title-asc" });
    assert.equal(ids(tasks), before);
  });
});

describe("filterAndSortTasks: 絞り込みの組み合わせ", () => {
  it("ステータスだけで絞り込む", () => {
    assert.equal(ids(filterAndSortTasks(tasks, { ...all, status: "active" })), "a,b");
  });
  it("ステータス × キーワード × 並べ替え", () => {
    assert.equal(ids(filterAndSortTasks(tasks, { status: "active", query: "開発", sortBy: "created-asc" })), "a");
  });
  it("該当なしは空配列", () => {
    assert.deepEqual(filterAndSortTasks(tasks, { ...all, query: "存在しない" }), []);
  });
});

describe("groupTasksForList: ピン留め", () => {
  const pinnedTasks: Task[] = [
    task("p-active", { title: "ピンA", status: "active", isPinned: true, createdAt: "2026-10-01T00:00:00Z" }),
    task("p-done", { title: "ピンD", status: "done", isPinned: true, createdAt: "2026-10-05T00:00:00Z" }),
    task("n-active", { title: "通常A", status: "active", createdAt: "2026-10-03T00:00:00Z" }),
    task("n-unread", { title: "通常U", status: "unread", createdAt: "2026-10-04T00:00:00Z" }),
  ];
  const opts = { status: "all", query: "", sortBy: "created-desc" } as const;

  it("ピン留めしたタスクは、ステータスに関わらず Pinned に入り、ステータスのセクションには重複しない", () => {
    const g = groupTasksForList(pinnedTasks, opts);
    assert.equal(ids(g.pinned), "p-done,p-active");
    assert.equal(ids(g.byStatus.active), "n-active");
    assert.equal(ids(g.byStatus.done), "");
    assert.equal(ids(g.byStatus.unread), "n-unread");
  });

  it("ステータスのタブは Pinned にも適用される", () => {
    const g = groupTasksForList(pinnedTasks, { ...opts, status: "active" });
    assert.equal(ids(g.pinned), "p-active");
    assert.equal(ids(g.byStatus.active), "n-active");
  });

  it("検索キーワードは Pinned にも適用される", () => {
    assert.equal(ids(groupTasksForList(pinnedTasks, { ...opts, query: "ピン" }).pinned), "p-done,p-active");
    assert.equal(ids(groupTasksForList(pinnedTasks, { ...opts, query: "通常" }).pinned), "");
  });

  it("並べ替えは Pinned の中にも適用される", () => {
    assert.equal(ids(groupTasksForList(pinnedTasks, { ...opts, sortBy: "created-asc" }).pinned), "p-active,p-done");
  });

  it("ピン留めがなければ Pinned は空になる", () => {
    assert.deepEqual(groupTasksForList(tasks, all).pinned, []);
  });
});

describe("カテゴリの絞り込み", () => {
  const list: Task[] = [
    task("a", { category: "開発", status: "active", isPinned: true }),
    task("b", { category: "開発", status: "done" }),
    task("c", { category: "企画", status: "active" }),
    task("d", { category: "企画", status: "unread" }),
  ];
  const base = { status: "all", query: "", sortBy: "created-desc" } as const;

  it("null はすべてのカテゴリ", () => {
    assert.equal(filterAndSortTasks(list, { ...base, category: null }).length, 4);
    assert.equal(filterAndSortTasks(list, base).length, 4);
  });
  it("指定したカテゴリだけに絞る", () => {
    assert.deepEqual(filterAndSortTasks(list, { ...base, category: "企画" }).map((t) => t.id).sort(), ["c", "d"]);
  });
  it("存在しないカテゴリは空", () => {
    assert.deepEqual(filterAndSortTasks(list, { ...base, category: "なし" }), []);
  });
  it("ステータス・検索・ピン留めと組み合わせられる", () => {
    const g = groupTasksForList(list, { ...base, status: "active", category: "開発" });
    assert.deepEqual(g.pinned.map((t) => t.id), ["a"]);
    assert.deepEqual(g.byStatus.active, []);
    assert.deepEqual(filterAndSortTasks(list, { ...base, category: "企画", query: "d" }).map((t) => t.id), ["d"]);
  });
  it("listCategories: 件数の多い順、同数は名前順", () => {
    const sorted = listCategories(list);
    assert.equal(sorted.length, 2);
    assert.ok(sorted.every((c) => c.count === 2));
    assert.deepEqual(sorted.map((c) => c.name), ["企画", "開発"].sort((x, y) => x.localeCompare(y, "ja")));
    assert.deepEqual(listCategories([]), []);
  });
});
