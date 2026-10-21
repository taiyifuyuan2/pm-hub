import { useState, type FormEvent } from "react";
import { GmailPanel } from "./GmailPanel";
import { Icon, type IconName } from "../../components/Icon";
import { PullToRefresh } from "../../components/PullToRefresh";
import { useAppStore } from "../../store/useAppStore";
import type { MessageSource, MessageThread } from "../../types";
import { toast } from "../../store/toastStore";
import { formatDateTime, formatRelative } from "../../utils/format";

const EMPTY_MESSAGES: MessageThread[] = [];

/** 送信元ごとの表示。色だけでなく、アイコンと名前で区別する */
const SOURCE: Record<MessageSource, { label: string; icon: IconName }> = {
  slack: { label: "Slack", icon: "slack" },
  email: { label: "メール", icon: "mail" },
  beeper: { label: "Beeper", icon: "chat" },
  line: { label: "LINE", icon: "chat" },
  manual: { label: "メモ", icon: "note" },
};

/** 外部サービスのメッセージを貼り付けて、このタスクに記録するフォーム */
function AddMessageForm({ taskId }: { taskId: string }) {
  const addMessage = useAppStore((s) => s.addMessage);
  const [sender, setSender] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      await addMessage(taskId, { sender: sender.trim() || "自分", content });
      setContent("");
    } catch {
      toast.error("メッセージを追加できませんでした。ローカルサーバーの状態を確認してください。");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-lg border border-line bg-hover px-3 py-1.5 text-xs text-fg outline-none focus:border-ink";
  return (
    <form onSubmit={submit} className="space-y-2 border-b border-line p-3">
      <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="送信者（省略可）" aria-label="送信者" className={field} />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="メッセージを貼り付けて記録"
        aria-label="メッセージ"
        rows={3}
        className={`${field} resize-none`}
      />
      <button
        type="submit"
        disabled={!content.trim() || busy}
        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-opacity disabled:opacity-40"
      >
        追加
      </button>
    </form>
  );
}

export function MessagesTab({ taskId }: { taskId: string }) {
  const messages = useAppStore((s) => s.messages[taskId] ?? EMPTY_MESSAGES);
  const refresh = useAppStore((s) => s.refresh);
  const deleteMessage = useAppStore((s) => s.deleteMessage);

  return (
    <PullToRefresh onRefresh={refresh}>
      <GmailPanel taskId={taskId} />
      <AddMessageForm taskId={taskId} />
      {messages.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-hover text-subtle">
            <Icon name="mail" size={22} />
          </div>
          <p className="text-sm font-medium text-fg">メッセージはありません</p>
          <p className="mt-1 text-xs leading-relaxed text-subtle">
            このタスクに関するメッセージを、上のフォームから記録できます。
            <br />
            一番上で下へ引っ張ると、最新の状態に更新できます。
          </p>
        </div>
      ) : (
        <ul className="space-y-2 p-3">
          {messages.map((m, i) => {
            const source = SOURCE[m.source];
            return (
              <li
                key={m.id}
                className="animate-fade-up rounded-xl border border-line bg-surface p-3"
                style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1 rounded-full bg-hover px-2 py-0.5 font-medium text-muted">
                    <Icon name={source.icon} size={12} />
                    {source.label}
                  </span>
                  <span className="truncate font-medium text-fg">{m.sender}</span>
                  <span className="ml-auto shrink-0 text-subtle" title={formatDateTime(m.timestamp)}>
                    {formatRelative(m.timestamp)}
                  </span>
                  <button
                    type="button"
                    aria-label="メッセージを削除"
                    onClick={() => deleteMessage(taskId, m.id).catch(() => toast.error("削除できませんでした"))}
                    className="shrink-0 rounded p-0.5 text-subtle hover:bg-hover hover:text-fg"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">{m.content}</p>
              </li>
            );
          })}
        </ul>
      )}
    </PullToRefresh>
  );
}
