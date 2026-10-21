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
    onSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = value.trim() !== "";

  return (
    <form className="shrink-0 px-4 pb-4 pt-2" onSubmit={submit}>
      <div className="rounded-xl border border-line-strong bg-raised shadow-sm transition-colors focus-within:border-focus">
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="メッセージ（Enter で改行・Ctrl+Enter で送信）"
          aria-label="エージェントへのメッセージ"
          style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
          className="block w-full resize-none rounded-t-xl bg-transparent px-3.5 pb-1 pt-3 text-sm leading-relaxed text-fg outline-none placeholder:text-subtle"
        />
        <div className="flex items-center gap-1.5 px-2 pb-2">
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

          <div className="flex-1" />

          <span className="hidden text-[11px] text-subtle sm:inline" aria-hidden="true">
            Ctrl+Enter
          </span>

          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 rounded-lg bg-active px-3.5 py-1.5 text-sm font-medium text-fg hover:bg-line-strong"
            >
              <Icon name="stop" size={13} />
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-sm font-medium text-on-ink transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              送信
              <Icon name="send" size={13} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
