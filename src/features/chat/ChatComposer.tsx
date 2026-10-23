import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { CHAT_MODELS, type ChatModelId, type PermissionMode } from "../../../shared/agent";
import { Icon } from "../../components/Icon";
import { Select } from "../../components/Select";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  /** エージェントの実行中（許可確認の回答待ちを含む） */
  running: boolean;
  awaitingPermission?: boolean;
  onReviewPermission?: () => void;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  model: ChatModelId | null;
  onModelChange: (model: ChatModelId | null) => void;
}

/** 入力欄の高さの範囲（px）。内容に合わせて伸び、上限を超えたらスクロールする */
const MIN_HEIGHT = 72;
const MAX_HEIGHT = 220;

const MODEL_OPTIONS = [
  { value: "", label: "既定のモデル", hint: "Claude Code の設定に従う" },
  ...CHAT_MODELS.map((m) => ({ value: m.id as string, label: m.label, hint: m.id as string })),
];

/**
 * チャットの入力エリア。入力欄の下に、権限・モデルのクイック設定と送信ボタンを並べる。
 * - 入力欄は内容に合わせて高さが伸びる
 * - Enter は改行、Ctrl+Enter（Mac は ⌘+Enter）で送信。日本語変換の確定の Enter では送信しない
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  running,
  awaitingPermission = false,
  onReviewPermission,
  permissionMode,
  onPermissionModeChange,
  model,
  onModelChange,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 内容に合わせて高さを調整する（いったん縮めてから、必要な高さを測る）
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, el.scrollHeight))}px`;
  }, [value]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!running && value.trim()) onSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!running && value.trim()) onSend();
    }
  };

  const canSend = value.trim() !== "";

  return (
    <form className="shrink-0 px-4 pb-4 pt-2" onSubmit={submit}>
      <div className="mx-auto w-full max-w-3xl">
        {running && (
          <div className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${awaitingPermission ? "bg-warn-soft text-warn" : "bg-new-soft text-new"}`}>
            <Icon name={awaitingPermission ? "alert" : "sparkle"} size={15} className="shrink-0" />
            <span className="min-w-0 flex-1" role="status">
              {awaitingPermission ? "操作の確認を待っています" : "Claude が作業しています…"}
            </span>
            {awaitingPermission && onReviewPermission && (
              <button type="button" onClick={onReviewPermission} className="shrink-0 rounded-md px-2 py-1 font-semibold underline underline-offset-4 hover:bg-warn/10">
                確認する
              </button>
            )}
          </div>
        )}
        <div className="rounded-2xl border border-line-strong bg-raised shadow-sm transition-colors focus-within:border-new focus-within:ring-2 focus-within:ring-new/10">
          <div className="flex items-center gap-2 px-4 pt-3">
            <Icon name="chat" size={14} className="text-new" />
            <label htmlFor="chat-input" className="text-xs font-medium text-muted">Claude に依頼</label>
            {value.length > 0 && <span className="ml-auto text-[10px] text-subtle">下書き · {value.length.toLocaleString()} 文字</span>}
          </div>
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={running ? "次の依頼を下書きできます…" : "やりたいことや、困っていることを書いてください…"}
            aria-label="エージェントへのメッセージ"
            aria-describedby="chat-input-hint"
            style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
            className="block w-full resize-none bg-transparent px-4 pb-2 pt-2.5 text-sm leading-7 text-fg outline-none placeholder:text-subtle"
          />
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line/70 px-2.5 py-2.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              <Select<PermissionMode>
                ariaLabel="権限"
                variant="ghost"
                size="sm"
                placement="top"
                value={permissionMode}
                onChange={onPermissionModeChange}
                tone={permissionMode === "allow-all" ? "warn" : "default"}
                title={
                  permissionMode === "allow-all"
                    ? "このセッション中は、ファイル編集やコマンド実行を確認なしで許可しています"
                    : "ファイル編集やコマンド実行のたびに確認します"
                }
                options={[
                  { value: "manual", label: "手動確認", hint: "操作のたびに確認する" },
                  { value: "allow-all", label: "このセッション中すべて許可", hint: "確認なしで実行する（注意）" },
                ]}
                menuMinWidth={250}
                className="max-w-[14rem]"
              />

              <Select<string>
                ariaLabel="モデル"
                variant="ghost"
                size="sm"
                placement="top"
                value={model ?? ""}
                onChange={(v) => onModelChange((v || null) as ChatModelId | null)}
                options={MODEL_OPTIONS}
                menuMinWidth={220}
              />
            </div>

            {running ? (
              <button
                type="button"
                onClick={onStop}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-fg hover:bg-hover"
              >
                <Icon name="stop" size={13} />
                停止
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-on-ink shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
              >
                送信
                <Icon name="send" size={13} />
              </button>
            )}
          </div>
        </div>
        <p id="chat-input-hint" className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-[10px] text-subtle">
          <span>{running ? "下書きは、作業が終わってから送信できます" : "Enter で改行 · Ctrl / ⌘ + Enter で送信"}</span>
          <span className="inline-flex items-center gap-1"><Icon name="folder" size={11} /> このタスクのメモと会話を参照</span>
        </p>
      </div>
    </form>
  );
}
