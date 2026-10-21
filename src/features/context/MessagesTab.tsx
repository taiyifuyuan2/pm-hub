import { Icon, type IconName } from "../../components/Icon";
import { PullToRefresh } from "../../components/PullToRefresh";
import { useAppStore } from "../../store/useAppStore";
import type { MessageSource, MessageThread } from "../../types";
import { formatDateTime, formatRelative } from "../../utils/format";

const EMPTY_MESSAGES: MessageThread[] = [];

/** 送信元ごとの表示。色だけでなく、アイコンと名前で区別する */
const SOURCE: Record<MessageSource, { label: string; icon: IconName }> = {
  slack: { label: "Slack", icon: "slack" },
  email: { label: "メール", icon: "mail" },
  beeper: { label: "Beeper", icon: "chat" },
};

export function MessagesTab({ taskId }: { taskId: string }) {
  const messages = useAppStore((s) => s.messages[taskId] ?? EMPTY_MESSAGES);
  const refresh = useAppStore((s) => s.refresh);

  return (
    <PullToRefresh onRefresh={refresh}>
      {messages.length === 0 ? (
        <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-hover text-subtle">
            <Icon name="mail" size={22} />
          </div>
          <p className="text-sm font-medium text-fg">メッセージはありません</p>
          <p className="mt-1 text-xs leading-relaxed text-subtle">
            このタスクに紐づくメール・Slack・DM のスレッドが、ここに表示されます。
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
