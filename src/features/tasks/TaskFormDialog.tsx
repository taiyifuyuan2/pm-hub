import { useId, useMemo, useState } from "react";
import { Modal, buttonClass } from "../../components/Modal";
import { Select } from "../../components/Select";
import { useAppStore } from "../../store/useAppStore";
import type { Task, TaskStatus } from "../../types";
import { categoryColorVar } from "../../utils/category";
import { listCategories } from "./filterTasks";

const STATUS_OPTIONS: { value: TaskStatus; label: string; hint: string }[] = [
  { value: "active", label: "進行中", hint: "いま取り組む" },
  { value: "unread", label: "未読", hint: "まだ見ていない" },
  { value: "scheduled", label: "予定", hint: "日時を決めて取り組む" },
  { value: "done", label: "完了", hint: "取り組みを終えた" },
];

const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle hover:border-subtle focus:border-focus";

/** ISO 文字列 → datetime-local の値（ローカル時刻） */
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** task を渡すと編集、渡さなければ新規作成 */
export function TaskFormDialog({ task, onClose }: { task?: Task; onClose: () => void }) {
  const tasks = useAppStore((s) => s.tasks);
  const addTask = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const categories = useMemo(() => listCategories(tasks), [tasks]);
  const categoryListId = useId();

  const [title, setTitle] = useState(task?.title ?? "");
  // 新規作成では、カテゴリの絞り込み中ならそのカテゴリを初期値にする
  const [category, setCategory] = useState(task?.category ?? categoryFilter ?? "");
  const [project, setProject] = useState(task?.project ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "active");
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(task?.scheduledAt));
  const [description, setDescription] = useState(task?.description ?? "");

  const needsSchedule = status === "scheduled" && scheduledAt === "";
  const canSubmit = title.trim() !== "" && !needsSchedule;

  const submit = () => {
    if (!canSubmit) return;
    const values = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || "未分類",
      project: project.trim() || undefined,
      status,
      // datetime-local の値はローカル時刻なので、Date 経由で ISO 文字列に直す。空なら予定日時なし
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    };
    if (task) updateTask(task.id, values);
    else addTask(values);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      onSubmit={submit}
      title={task ? "タスクを編集" : "新規タスク"}
      eyebrow={task ? task.title : "詳細を指定して作成"}
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted">タイトル *</span>
        <input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="何をしますか？" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">カテゴリ</span>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full"
              style={{ background: categoryColorVar(category || "未分類") }}
              aria-hidden="true"
            />
            <input
              list={categoryListId}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="未分類"
              className={`${inputClass} pl-7`}
            />
          </div>
          <datalist id={categoryListId}>
            {categories.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted">ステータス</span>
          <Select<TaskStatus>
            ariaLabel="ステータス"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            className="h-[38px] w-full"
            menuMinWidth={200}
          />
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted">プロジェクト</span>
        <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="例: YouTube、PM Hub" className={inputClass} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted">予定日時{status === "scheduled" && " *"}</span>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          aria-invalid={needsSchedule}
          className={inputClass}
        />
        {needsSchedule && <span className="block text-xs text-warn">「予定」にするには、予定日時を選んでください</span>}
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted">説明</span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} />
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={buttonClass.ghost}>
          キャンセル
        </button>
        <button type="submit" disabled={!canSubmit} className={buttonClass.primary}>
          {task ? "保存" : "作成"}
        </button>
      </div>
    </Modal>
  );
}
