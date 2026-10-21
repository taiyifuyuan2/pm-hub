import { Router } from "express";
import type { PermissionMode, PermissionRulesResponse } from "../../../shared/agent";
import { ruleLabel } from "../agent/permissionRules";
import { rulesRepo, tasksRepo } from "../db/repositories";
import { isTaskId } from "../validation";

export const permissionsRouter = Router();

/** :id は DB の自動採番（正の整数）に限定する */
const parseRuleId = (value: string) => (/^[1-9]\d{0,9}$/.test(value) ? Number(value) : undefined);

/**
 * GET /api/permissions/rules[?taskId=]
 * 「このセッションでは常に許可」で登録されたルールの一覧。taskId を渡すとそのタスクだけに絞る。
 */
permissionsRouter.get("/permissions/rules", (req, res) => {
  const { taskId } = req.query;
  if (taskId !== undefined && !isTaskId(taskId)) return res.status(400).json({ error: "taskId が不正です" });

  const rules = rulesRepo.listDetailed(taskId as string | undefined).map((r) => ({ ...r, label: ruleLabel(r) }));
  const body: PermissionRulesResponse = { rules };
  res.json(body);
});

/** DELETE /api/permissions/rules/:id — 指定した1件だけを解除する */
permissionsRouter.delete("/permissions/rules/:id", (req, res) => {
  const id = parseRuleId(req.params.id);
  if (id === undefined) return res.status(400).json({ error: "id が不正です" });
  if (!rulesRepo.removeById(id)) return res.status(404).json({ error: "ルールが見つかりません" });
  res.status(204).end();
});

/**
 * DELETE /api/permissions/rules[?taskId=] — まとめて解除する。
 * taskId を渡すとそのタスクのルールだけ、省略すると全タスクのルールを解除する。
 */
permissionsRouter.delete("/permissions/rules", (req, res) => {
  const { taskId } = req.query;
  if (taskId !== undefined && !isTaskId(taskId)) return res.status(400).json({ error: "taskId が不正です" });

  const removed = taskId ? Number(rulesRepo.clear(taskId).changes) : rulesRepo.clearAll();
  res.json({ removed });
});

/**
 * PUT /api/tasks/:id/permission-mode  body: { mode: "manual" | "allow-all" }
 * allow-all: このセッション中は、許可確認なしですべてのツールを許可する（会話をリセットすると解除される）。
 * manual: 毎回確認に戻す（個別に登録した「常に許可」ルールは残る）。
 */
permissionsRouter.put("/tasks/:id/permission-mode", (req, res) => {
  const { id } = req.params;
  if (!isTaskId(id)) return res.status(400).json({ error: "id が不正です" });
  const mode = req.body?.mode as PermissionMode | undefined;
  if (mode !== "manual" && mode !== "allow-all") {
    return res.status(400).json({ error: "mode は manual か allow-all を指定してください" });
  }
  if (!tasksRepo.get(id)) return res.status(404).json({ error: "タスクが見つかりません" });
  rulesRepo.setAllowAll(id, mode === "allow-all");
  res.json({ mode });
});
