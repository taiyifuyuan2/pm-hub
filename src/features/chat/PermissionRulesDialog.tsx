import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { Modal, buttonClass } from "../../components/Modal";
import { ListSkeleton } from "../../components/Skeleton";
import { api } from "../../lib/api";
import { toast } from "../../store/toastStore";
import type { PermissionRule } from "../../types";
import { formatDateTime } from "../../utils/format";

interface PermissionRulesDialogProps {
  /** 開いたときに選択中のタスク。「このタスクのみ」の絞り込みに使う */
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  /** ルールが増減したときに呼ぶ（ヘッダーの件数表示を更新するため） */
  onChanged: () => void;
}

export function PermissionRulesDialog({ taskId, taskTitle, onClose, onChanged }: PermissionRulesDialogProps) {
  const [onlyThisTask, setOnlyThisTask] = useState(true);
  const [rules, setRules] = useState<PermissionRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.permissionRules(onlyThisTask ? taskId : undefined);
      setRules(res.rules);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [onlyThisTask, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (rule: PermissionRule) => {
    setRemovingId(rule.id);
    try {
      await api.deletePermissionRule(rule.id);
      // 他のルールは触らず、その1件だけを一覧から外す
      setRules((current) => current?.filter((r) => r.id !== rule.id) ?? null);
      onChanged();
      toast.success("許可ルールを解除しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      void load(); // すでに消えている場合などに備えて、最新の状態に合わせる
    } finally {
      setRemovingId(null);
    }
  };

  const clearAll = async () => {
    await api.clearPermissionRules(onlyThisTask ? taskId : undefined);
    setRules([]);
    onChanged();
    toast.success("許可ルールをすべて解除しました");
  };

  return (
    <>
      <Modal
        onClose={onClose}
        title="許可ルール管理"
        width="max-w-xl"
        eyebrow={<Breadcrumbs items={[{ label: taskTitle }, { label: "許可ルール" }]} />}
      >
        <p className="-mt-1 text-xs leading-relaxed text-muted">
          「このセッションでは常に許可」で登録された、自動で許可する操作の一覧です。
        </p>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={onlyThisTask}
            onChange={(e) => {
              setRules(null);
              setOnlyThisTask(e.target.checked);
            }}
            className="size-3.5 accent-[var(--c-ink)]"
          />
          <span>
            このタスクのみ表示（<span className="text-fg">{taskTitle}</span>）
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">
            {error}
          </p>
        )}

        <div className="max-h-[46vh] space-y-2 overflow-y-auto">
          {rules === null ? (
            <ListSkeleton rows={3} />
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-hover text-subtle">
                <Icon name="check" size={18} />
              </div>
              <p className="text-sm text-fg">登録されている許可ルールはありません</p>
              <p className="mt-1 text-xs text-subtle">許可カードの「このセッションでは常に許可」で追加されます</p>
            </div>
          ) : (
            rules.map((rule) => {
              // 「このセッション中すべて許可」は、全ツールに合致する特別なルール
              const allowAll = rule.toolName === "*";
              return (
                <div key={rule.id} className="flex animate-fade-up items-start gap-3 rounded-xl border border-line bg-surface p-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-hover px-1.5 py-px font-mono text-muted">{allowAll ? "すべてのツール" : rule.toolName}</span>
                      {!onlyThisTask && rule.taskTitle && <span className="truncate text-subtle">{rule.taskTitle}</span>}
                    </div>
                    <p className={`break-all font-mono text-xs ${allowAll ? "font-medium text-warn" : "text-fg"}`}>
                      {allowAll ? "確認なしで許可（このセッション中）" : rule.pattern || "（このツールのすべての操作）"}
                    </p>
                    <p className="text-[11px] text-subtle">登録: {formatDateTime(rule.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => remove(rule)}
                    disabled={removingId === rule.id}
                    aria-label={`${rule.label} を解除`}
                    className="shrink-0 rounded-lg bg-hover px-3 py-1.5 text-xs text-fg transition-colors hover:bg-bad-soft hover:text-bad disabled:opacity-50"
                  >
                    {removingId === rule.id ? "解除中…" : "解除"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setConfirmClear(true)}
            disabled={!rules || rules.length === 0}
            className="rounded-lg px-3 py-2 text-xs text-bad hover:bg-bad-soft disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {onlyThisTask ? "このタスクの許可ルールをすべて解除" : "すべての許可ルールを解除"}
          </button>
          <button onClick={onClose} className={buttonClass.ghost}>
            閉じる
          </button>
        </div>
      </Modal>

      {confirmClear && (
        <ConfirmDialog
          title="許可ルールをすべて解除"
          confirmLabel="すべて解除する"
          danger
          onConfirm={clearAll}
          onClose={() => setConfirmClear(false)}
        >
          <p>
            {onlyThisTask ? `「${taskTitle}」の` : "全タスクの"}許可ルール {rules?.length ?? 0} 件を解除します。
          </p>
          <p className="mt-2 text-xs text-subtle">解除後は、該当する操作のたびに許可の確認が表示されます。</p>
        </ConfirmDialog>
      )}
    </>
  );
}
