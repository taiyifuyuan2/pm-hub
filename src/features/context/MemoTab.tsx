import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Markdown } from "../../components/Markdown";
import { useAppStore, type MemoSaveState } from "../../store/useAppStore";
import { formatDateTime } from "../../utils/format";

type ViewMode = "edit" | "split" | "preview";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "edit", label: "編集" },
  { id: "split", label: "分割" },
  { id: "preview", label: "プレビュー" },
];

/** メモの保存状態の表示。入力中は「未保存」、保存に失敗したら警告にする */
function SaveBadge({ state, updatedAt }: { state: MemoSaveState | undefined; updatedAt?: string }) {
  if (state === "dirty" || state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-subtle" role="status">
        <Icon name="refresh" size={12} className="animate-spin-slow" />
        保存中…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 font-medium text-bad" role="alert">
        <Icon name="alert" size={12} />
        保存できませんでした
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-subtle">
      {state === "saved" && <Icon name="check" size={12} className="text-new" />}
      {state === "saved" ? "保存しました" : updatedAt ? `最終更新 ${formatDateTime(updatedAt)}` : "未作成"}
    </span>
  );
}

export function MemoTab({ taskId }: { taskId: string }) {
  const memo = useAppStore((s) => s.memos[taskId]);
  const saveState = useAppStore((s) => s.memoSaveState[taskId]);
  const updateMemo = useAppStore((s) => s.updateMemo);
  const content = memo?.content ?? "";
  // メモがあれば読む画面から、なければ書く画面から始める
  const [mode, setMode] = useState<ViewMode>(content ? "preview" : "edit");

  const editor = (
    <textarea
      value={content}
      onChange={(e) => updateMemo(taskId, e.target.value)}
      placeholder="Markdown でメモを書く…"
      aria-label="メモ（Markdown）"
      spellCheck={false}
      autoFocus={mode === "edit"}
      className="min-h-0 flex-1 resize-none rounded-lg border border-line-strong bg-raised p-3 font-mono text-[13px] leading-relaxed text-fg outline-none placeholder:text-subtle hover:border-subtle focus:border-focus"
    />
  );

  const preview = (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-line bg-surface p-3">
      {content.trim() ? (
        <Markdown>{content}</Markdown>
      ) : (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-hover text-subtle">
            <Icon name="note" size={18} />
          </div>
          <p className="text-sm text-fg">メモはまだありません</p>
          <button onClick={() => setMode("edit")} className="mt-2 rounded-md px-3 py-1 text-xs font-medium text-info hover:bg-hover">
            書き始める
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div role="group" aria-label="表示の切り替え" className="mb-2 flex shrink-0 self-end rounded-lg bg-hover p-0.5 text-[11px]">
        {VIEW_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === m.id ? "bg-raised text-fg shadow-sm" : "text-subtle hover:text-fg"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 右列は幅が狭いので、分割表示は上下に並べる */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {mode !== "preview" && editor}
        {mode !== "edit" && preview}
      </div>

      <p className="mt-2 flex shrink-0 justify-end text-[11px]">
        <SaveBadge state={saveState} updatedAt={memo?.updatedAt} />
      </p>
    </div>
  );
}
