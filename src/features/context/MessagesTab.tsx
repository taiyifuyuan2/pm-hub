import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BeeperPanel } from "./BeeperPanel";
import { GmailPanel } from "./GmailPanel";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { PullToRefresh } from "../../components/PullToRefresh";
import { copyText } from "../../lib/clipboard";
import { useAppStore } from "../../store/useAppStore";
import type { MessageThread } from "../../types";
import { toast } from "../../store/toastStore";
import { formatDateTime } from "../../utils/format";

const EMPTY: MessageThread[] = [];
const SOURCE = { slack: "Slack", email: "メール", beeper: "Beeper", line: "LINE", manual: "手動記録" };
const day = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "日時不明" : date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
};

function Composer({ taskId }: { taskId: string }) {
  const addMessage = useAppStore((s) => s.addMessage);
  const [sender, setSender] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      await addMessage(taskId, { sender: sender.trim() || "自分", content: content.trim() });
      setContent("");
      toast.success("このタスクに記録しました");
    } catch { toast.error("記録できませんでした。入力を残しています。"); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="shrink-0 border-t border-line bg-surface p-3">
    <div className="rounded-2xl border border-line-strong bg-raised p-2.5 focus-within:border-focus">
      <input value={sender} onChange={(e) => setSender(e.target.value)} disabled={busy} maxLength={100} placeholder="送信者（省略すると自分）" aria-label="記録するメッセージの送信者" className="mb-1 w-full bg-transparent px-1 text-xs text-muted outline-none" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} disabled={busy} maxLength={20000} placeholder="メッセージを貼り付けて記録…" aria-label="記録するメッセージ" rows={2} className="block w-full resize-none bg-transparent px-1 text-sm leading-6 text-fg outline-none" />
      <div className="mt-1 flex items-center justify-between gap-2"><span className="text-[10px] text-subtle">タスク内の記録・相手には送信されません</span><button type="submit" disabled={!content.trim() || busy} className="flex shrink-0 items-center gap-1 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-on-ink disabled:opacity-40"><Icon name="plus" size={14} />{busy ? "保存中" : "記録"}</button></div>
    </div>
  </form>;
}

function Bubble({ message: m, onDelete }: { message: MessageThread; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const own = m.source === "manual" && m.sender === "自分";
  const long = m.content.length > 700;
  const time = new Date(m.timestamp);
  return <div className={`flex items-start gap-2 ${own ? "flex-row-reverse" : ""}`}>
    <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold text-info" aria-hidden="true">{[...m.sender][0] || "?"}</span>
    <div className="min-w-0 flex-1">
      <div className={`mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${own ? "justify-end" : ""}`}><span className="break-all text-xs font-semibold text-fg">{m.sender}</span><span className="text-[10px] text-subtle">{SOURCE[m.source]}</span></div>
      <div className={`rounded-2xl border px-3.5 py-3 ${own ? "rounded-tr-sm border-info/20 bg-info-soft" : "rounded-tl-sm border-line bg-surface"}`}>
        <p className="whitespace-pre-wrap break-words text-[14px] leading-7 text-fg [overflow-wrap:anywhere]">{long && !expanded ? `${m.content.slice(0, 700)}…` : m.content}</p>
        {long && <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-2 text-xs font-semibold text-info underline underline-offset-4">{expanded ? "折りたたむ" : "全文を読む"}</button>}
      </div>
      <div className={`mt-1 flex items-center gap-1 text-[10px] text-subtle ${own ? "justify-end" : ""}`}>
        <time dateTime={m.timestamp} title={formatDateTime(m.timestamp)} className="mr-1">{Number.isNaN(time.getTime()) ? "" : time.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time>
        <button aria-label={`${m.sender}のメッセージをコピー`} title="コピー" className="rounded-lg p-1.5 hover:bg-hover" onClick={() => void copyText(m.content).then(() => toast.success("コピーしました")).catch(() => toast.error("コピーできませんでした"))}><Icon name="copy" size={12} /></button>
        <button aria-label={`${m.sender}の記録を削除`} title="このタスクから削除" className="rounded-lg p-1.5 hover:bg-bad-soft hover:text-bad" onClick={onDelete}><Icon name="trash" size={12} /></button>
      </div>
    </div>
  </div>;
}

export function MessagesTab({ taskId }: { taskId: string }) {
  const messages = useAppStore((s) => s.messages[taskId] ?? EMPTY);
  const refresh = useAppStore((s) => s.refresh);
  const deleteMessage = useAppStore((s) => s.deleteMessage);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<MessageThread | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!query) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, query]);
  const visible = useMemo(() => messages.filter((m) => `${m.sender}\n${m.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)), [messages, query]);
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="shrink-0 border-b border-line bg-surface px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold text-fg"><Icon name="chat" size={16} />会話 <span className="text-subtle">{messages.length}件</span></span><button aria-expanded={connectionsOpen} onClick={() => setConnectionsOpen(!connectionsOpen)} className="flex items-center gap-1 rounded-lg bg-info-soft px-2.5 py-2 text-xs font-medium text-info"><Icon name="plus" size={13} />取り込む<Icon name={connectionsOpen ? "chevronDown" : "chevronRight"} size={12} /></button></div>
      <div className="flex items-center gap-2 rounded-xl bg-hover px-2.5 py-2"><Icon name="search" size={13} className="shrink-0 text-subtle" /><input aria-label="会話を検索" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="送信者・本文を検索" className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none" />{query && <button aria-label="会話の検索を解除" onClick={() => setQuery("")}><Icon name="x" size={13} /></button>}</div>
    </div>
    {connectionsOpen && <div className="max-h-[40vh] shrink-0 overflow-y-auto border-b border-line bg-raised"><GmailPanel taskId={taskId} /><BeeperPanel taskId={taskId} /></div>}
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-4 px-3 py-4">
        {visible.length === 0 ? <div className="px-4 py-8 text-center"><Icon name="chat" size={30} className="mx-auto mb-3 text-info" /><p className="text-sm font-semibold text-fg">{query ? "一致するメッセージはありません" : "会話を、ここに集めましょう"}</p><p className="mt-2 text-xs leading-6 text-subtle">{query ? "検索語を変えてみてください。" : "「取り込む」からメールやチャットを選ぶか、下の入力欄に貼り付けて記録できます。"}</p></div> : visible.map((m, index) => <div key={m.id}>
          {(index === 0 || day(visible[index - 1].timestamp) !== day(m.timestamp)) && <div className="mb-5 mt-2 text-center"><span className="rounded-full bg-hover px-3 py-1 text-[10px] font-medium text-subtle">{day(m.timestamp)}</span></div>}
          <Bubble message={m} onDelete={() => setDeleting(m)} />
        </div>)}
        <div ref={endRef} />
      </div>
    </PullToRefresh>
    <Composer taskId={taskId} />
    {deleting && <ConfirmDialog title="この記録を削除" confirmLabel="削除する" danger onClose={() => setDeleting(null)} onConfirm={() => deleteMessage(taskId, deleting.id)}><p>このタスクからメッセージを削除します。元のメールやチャットは残ります。</p></ConfirmDialog>}
  </div>;
}
