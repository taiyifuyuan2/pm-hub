import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { it } from "node:test";
import { loadTestBundle } from "../../scripts/test-bundle";

interface TestStore {
  getState(): {
    updateMemo(taskId: string, content: string): void;
    refresh(): Promise<void>;
    memos: Record<string, { content: string }>;
    memoSaveState: Record<string, string>;
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function setup() {
  const writes: { content: string; result: ReturnType<typeof deferred> }[] = [];
  const api = {
    bootstrap: async () => ({ tasks: [], aiLogs: {}, messages: {}, memos: { task: { taskId: "task", content: "server-old", updatedAt: "old" } } }),
    saveMemo: (_id: string, content: string) => {
      const result = deferred();
      writes.push({ content, result });
      return result.promise;
    },
  };
  const { useAppStore } = await loadTestBundle<{ useAppStore: TestStore }>(new URL("./useAppStore.ts", import.meta.url), {
    "../lib/api": { api },
    "./toastStore": { toast: { error() {} } },
  });
  return { store: useAppStore, writes };
}

it("メモは保存中・保存失敗後の更新でも入力を保持する", async () => {
  const { store, writes } = await setup();
  store.getState().updateMemo("task", "unsaved");
  await delay(550);
  assert.equal(writes.length, 1);
  await store.getState().refresh();
  assert.equal(store.getState().memos.task.content, "unsaved");
  writes[0].result.reject(new Error("offline"));
  await delay(0);
  assert.equal(store.getState().memoSaveState.task, "error");
  await store.getState().refresh();
  assert.equal(store.getState().memos.task.content, "unsaved");
});

it("古い保存の完了で新しい入力を保存済みにせず、書き込みを直列化する", async () => {
  const { store, writes } = await setup();
  store.getState().updateMemo("task", "first");
  await delay(550);
  store.getState().updateMemo("task", "second");
  await delay(550);
  assert.equal(writes.length, 1);
  writes[0].result.resolve();
  await delay(0);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].content, "second");
  assert.equal(store.getState().memoSaveState.task, "saving");
  writes[1].result.resolve();
  await delay(0);
  assert.equal(store.getState().memoSaveState.task, "saved");
});
