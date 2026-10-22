import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { it } from "node:test";
import { loadTestBundle } from "../../../scripts/test-bundle";
import type { AgentEvent } from "../../../shared/agent";
import type { runClaude as Runner } from "./claudeRunner";

async function setup(failToSpawn = false) {
  const events: AgentEvent[] = [];
  let finishContext!: () => void;
  const context = new Promise<void>((resolve) => { finishContext = resolve; });
  let spawns = 0;
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    exitCode: null, pid: 123, kill() {},
  });
  const { runClaude } = await loadTestBundle<{ runClaude: typeof Runner }>(new URL("./claudeRunner.ts", import.meta.url), {
    "node:child_process": { spawn: () => {
      spawns++;
      queueMicrotask(() => {
        if (failToSpawn) child.emit("error", Object.assign(new Error("not found"), { code: "ENOENT" }));
        child.emit("close", 1);
      });
      return child;
    } },
    "node:fs/promises": { mkdir: async () => {} },
    "../config": { config: { workspaceRoot: "workspaces" } },
    "../db/repositories": { rulesRepo: { clear() {} }, sessionsRepo: { get() {}, save() {}, remove() {} } },
    "./taskContext": { writeTaskContext: () => context.then(() => "context ready") },
  });
  return { runClaude, events, finishContext, spawns: () => spawns };
}

for (const failToSpawn of [false, true]) {
  it(`準備が遅くても CLI の${failToSpawn ? "起動失敗" : "早期終了"}を検知して処理を完了する`, { timeout: 3000 }, async () => {
    const s = await setup(failToSpawn);
    const running = s.runClaude({ taskId: "task", message: "hello", emit: (e) => s.events.push(e), requestPermission: async () => "deny", signal: new AbortController().signal });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(s.spawns(), 0);
    s.finishContext();
    await running;
    assert.ok(s.events.some((e) => e.type === "error"));
  });
}

it("準備中に中断した場合は CLI を起動しない", async () => {
  const s = await setup();
  const controller = new AbortController();
  const running = s.runClaude({ taskId: "task", message: "hello", emit: (e) => s.events.push(e), requestPermission: async () => "deny", signal: controller.signal });
  controller.abort();
  s.finishContext();
  await running;
  assert.equal(s.spawns(), 0);
});
