import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { api, type GmailThread, type GoogleStatus } from "../../lib/api";
import { toast } from "../../store/toastStore";
import { useAppStore } from "../../store/useAppStore";
import { formatRelative } from "../../utils/format";

const field = "w-full rounded-lg border border-line bg-hover px-3 py-1.5 text-xs text-fg outline-none focus:border-ink";
const primary = "rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-opacity disabled:opacity-40";
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Gmail のスレッドを検索してタスクに取り込む。下書きも作れる（送信はしない） */
export function GmailPanel({ taskId }: { taskId: string }) {
  const importThread = useAppStore((s) => s.importGmailThread);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [query, setQuery] = useState("in:inbox");
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [busy, setBusy] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState({ to: "", subject: "", body: "" });

  const loadStatus = useCallback(() => api.googleStatus().then(setStatus).catch(() => setStatus(null)), []);

  useEffect(() => {
    if (open) void loadStatus();
  }, [open, loadStatus]);

  // ブラウザでログインして戻ってきたときに、状態を取り直す
  useEffect(() => {
    if (!open) return;
    const onFocus = () => void loadStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [open, loadStatus]);

  const login = async () => {
    try {
      const { url } = await api.googleLogin();
      await openUrl(url);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const logout = async () => {
    await api.googleLogout();
    setThreads([]);
    void loadStatus();
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setThreads(await api.gmailThreads(query));
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (t: GmailThread) => {
    try {
      const n = await importThread(taskId, t.id);
      toast.success(n > 0 ? `${n} 件のメッセージを取り込みました` : "新しいメッセージはありません");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const createDraft = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.gmailDraft(draft);
      toast.success("Gmail の下書きに保存しました（送信はされていません）");
      setDraft({ to: "", subject: "", body: "" });
      setDraftOpen(false);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
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
        <Icon name="mail" size={14} />
        Gmail から取り込む
        <Icon name={open ? "chevronDown" : "chevronRight"} size={14} className="ml-auto" />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {!status ? (
            <p className="text-xs text-subtle">サーバーに接続できません</p>
          ) : !status.configured ? (
            <p className="text-xs leading-relaxed text-subtle">
              Google の認証ファイルが見つかりません。<code>%USERPROFILE%\.pm-hub</code> に <code>google-client.json</code>{" "}
              を置いてください。
            </p>
          ) : !status.connected ? (
            <button type="button" onClick={login} className={primary}>
              Google にログイン
            </button>
          ) : (
            <>
              {!status.calendar && (
                <div className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[11px] leading-snug text-warn">
                  <span className="min-w-0 flex-1">
                    Google カレンダーの空き時間も使うには、もう一度ログインしてください（予定の題名や内容は読みません）。
                  </span>
                  <button type="button" onClick={login} className="shrink-0 font-medium underline">
                    ログイン
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-subtle">
                <span className="truncate">{status.email ?? "ログイン済み"}</span>
                <button type="button" className="ml-auto shrink-0 underline hover:text-fg" onClick={logout}>
                  ログアウト
                </button>
              </div>
              <form onSubmit={search} className="flex gap-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Gmail の検索（例: from:abc label:案件A）"
                  aria-label="Gmail の検索"
                  className={field}
                />
                <button type="submit" disabled={busy} className={`${primary} shrink-0`}>
                  検索
                </button>
              </form>
              <ul className="space-y-1">
                {threads.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 rounded-lg border border-line p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-fg">{t.subject}</p>
                      <p className="truncate text-[11px] text-subtle">
                        {t.from} ・ {formatRelative(t.date)}
                      </p>
                      <p className="line-clamp-2 text-[11px] text-muted">{t.snippet}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => doImport(t)}
                      className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-fg hover:bg-hover"
                    >
                      取り込む
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setDraftOpen((v) => !v)} className="text-xs text-muted underline hover:text-fg">
                下書きを作る
              </button>
              {draftOpen && (
                <form onSubmit={createDraft} className="space-y-1">
                  <input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder="宛先" aria-label="宛先" className={field} />
                  <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="件名" aria-label="件名" className={field} />
                  <textarea
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    placeholder="本文"
                    aria-label="本文"
                    rows={4}
                    className={`${field} resize-none`}
                  />
                  <button type="submit" disabled={busy || !draft.to.trim() || !draft.body.trim()} className={primary}>
                    下書きに保存
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
