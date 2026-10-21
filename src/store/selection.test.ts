import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Task } from "../types";
import { resolveSelectedTaskId } from "./selection";

const task = (id: string, status: Task["status"]): Task => ({
  id,
  title: id,
  description: "",
  status,
  category: "x",
  createdAt: "2026-10-01T00:00:00Z",
  isPinned: false,
});

const tasks = [task("a", "done"), task("b", "active"), task("c", "scheduled")];

describe("resolveSelectedTaskId", () => {
  it("希望の ID があれば、それを選ぶ（完了済みでも）", () => {
    assert.equal(resolveSelectedTaskId(tasks, "c"), "c");
    assert.equal(resolveSelectedTaskId(tasks, "a"), "a");
  });

  it("希望の ID のタスクが存在しなければ、先頭の未完了タスクにする", () => {
    assert.equal(resolveSelectedTaskId(tasks, "deleted-task"), "b");
  });

  it("希望がなければ（初回起動）、先頭の未完了タスクにする", () => {
    assert.equal(resolveSelectedTaskId(tasks, null), "b");
  });

  it("未完了のタスクがなければ、先頭のタスクにする", () => {
    assert.equal(resolveSelectedTaskId([task("x", "done"), task("y", "done")], "gone"), "x");
  });

  it("タスクが1件もなければ null（選択なし）", () => {
    assert.equal(resolveSelectedTaskId([], "a"), null);
    assert.equal(resolveSelectedTaskId([], null), null);
  });
});
