import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { api, type BeeperChat, type BeeperStatus } from "../../lib/api";
import { Switch } from "../../components/Switch";
import { useInboxStore } from "../../store/inboxStore";
import { toast } from "../../store/toastStore";
import { useAppStore } from "../../store/useAppStore";
import { formatRelative } from "../../utils/format";

const field = "w-full rounded-lg border border-line bg-hover px-3 py-1.5 text-xs text-fg outline-none focus:border-ink";
const primary = "rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-opacity disabled:opacity-40";
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Beeper（LINE・Telegram・WhatsApp など）のチャットを選んで、直近のメッセージをタスクに取り込む */
export function BeeperPanel({ taskId }: { taskId: string }) {
  const importChat = useAppStore((s) => s.importBeeperChat);
  const watched = useInboxStore((s) => s.watched);
  const setWatch = useInboxStore((s) => s.setWatch);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<BeeperStatus | null>(null);
  const [token, setToken] = useState("");
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<BeeperChat[]>([]);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(() => api.beeperStatus().then(setStatus).catch(() => setStatus(null)), []);

  const search = useCallback(
    async (q: string) => {
      setBusy(true);
      try {
        setChats(await api.beeperChats(q));
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (open) void loadStatus();
  }, [open, loadStatus]);

  useEffect(() => {
    if (open && status?.valid) void search("");
  }, [open, status?.valid, search]);

  const saveToken = async (e: FormEvent) => {
    e.preventDefault();
    await api.saveBeeperToken(token.trim());
    setToken("");
    void loadStatus();
  };

  const doImport = async (c: BeeperChat) => {
    try {
      const n = await importChat(taskId, c.id);
      toast.success(n > 0 ? `${n} 件のメッセージを取り込みました` : "新しいメッセージはありません");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted hover:bg-hover"
      >
        <Icon name="chat" size={14} />
        Beeper から取り込む
        <Icon name={open ? "chevronDown" : "chevronRight"} size={14} className="ml-auto" />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {!status ? (
            <p className="text-xs text-subtle">サーバーに接続できません</p>
          ) : !status.running ? (
            <p className="text-xs leading-relaxed text-subtle">Beeper Desktop に接続できません。Beeper を起動してから、開き直してください。</p>
          ) : !status.valid ? (
            <form onSubmit={saveToken} className="space-y-1">
              <p className="text-xs leading-relaxed text-subtle">
                {status.hasToken ? "トークンが無効です。" : ""}
                Beeper の設定（Developers）でアクセストークンを作り、ここに貼り付けてください。読み取りにだけ使います。
              </p>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="アクセストークン"
                aria-label="Beeper のアクセストークン"
                autoComplete="off"
                className={field}
              />
              <button type="submit" disabled={!token.trim()} className={primary}>
                保存
              </button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] text-subtle">
                <span className="truncate">接続中: {status.networks.join(" / ") || "(アカウントなし)"}</span>
                <button
                  type="button"
                  className="ml-auto shrink-0 underline hover:text-fg"
                  onClick={() => api.deleteBeeperToken().then(() => { setChats([]); return loadStatus(); })}
                >
                  切断
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void search(query);
                }}
                className="flex gap-1"
              >
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="チャット名・サービス名で絞り込み" aria-label="チャットの検索" className={field} />
                <button type="submit" disabled={busy} className={`${primary} shrink-0`}>
                  検索
                </button>
              </form>
              <ul className="space-y-1">
                {chats.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-fg">{c.title}</p>
                      <p className="truncate text-[11px] text-subtle">
                        {c.network} ・ {formatRelative(c.lastActivity)}
                        {c.unreadCount > 0 ? ` ・ 未読 ${c.unreadCount}` : ""}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1 text-[10px] text-subtle" title="新しいメッセージが届いたら、自動で返信案を作ります（送信はしません）">
                      自動返信案
                      <Switch
                        checked={watched.some((w) => w.chatID === c.id)}
                        onChange={(on) => void setWatch({ chatID: c.id, title: c.title, network: c.network }, on)}
                        label={`${c.title} の自動返信案`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => doImport(c)}
                      className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-fg hover:bg-hover"
                    >
                      取り込む
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
