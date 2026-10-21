import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { SendWithUndo } from "../../components/SendWithUndo";
import { Switch } from "../../components/Switch";
import { toast } from "../../store/toastStore";
import { useInboxStore } from "../../store/inboxStore";
import type { Suggestion } from "../../types";
import { formatRelative } from "../../utils/format";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const iconBtn =
  "flex size-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-fg disabled:opacity-40";

/** チャット名の頭文字を丸で見せる。色は名前から決めて、同じ人はいつも同じ色にする */
function Avatar({ name }: { name: string }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.codePointAt(0)!) % 360, 7);
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ background: `hsl(${hue} 45% 45%)` }}
    >
      {[...name][0] ?? "?"}
    </span>
  );
}

function SuggestionCard({ s, index }: { s: Suggestion; index: number }) {
  const { send, putInInput, regenerate, dismiss } = useInboxStore.getState();
  const [text, setText] = useState(s.draft);
  const [lastDraft, setLastDraft] = useState(s.draft);
  const area = useRef<HTMLTextAreaElement>(null);

  // 再生成などでサーバー側の文面が変わったときは、入力中の内容をそちらに合わせる
  if (s.draft !== lastDraft) {
    setLastDraft(s.draft);
    setText(s.draft);
  }

  // 文面の長さに合わせて入力欄を広げる
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text, s.status]);

  const sent = s.status === "sent";

  return (
    <li
      className={`animate-fade-up rounded-2xl border p-3 ${sent ? "border-line bg-canvas opacity-80" : "border-line bg-surface shadow-sm"}`}
      style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}
    >
      <div className="flex items-center gap-2">
        <Avatar name={s.chatTitle} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{s.chatTitle}</p>
          <p className="text-[11px] text-subtle">
            {s.network} ・ {formatRelative(s.incomingAt)}
          </p>
        </div>
        {!sent && (
          <button type="button" className={iconBtn} aria-label="この返信案を捨てる" title="捨てる" onClick={() => void dismiss(s.id)}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {/* 相手のメッセージ */}
      <p className="mt-2 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-hover px-3 py-2 text-sm leading-relaxed text-fg">
        {s.incoming}
      </p>

      {/* 返信案 */}
      <div className="mt-2">
        {s.status === "generating" && (
          <div className="space-y-1.5" role="status" aria-live="polite">
            <p className="flex items-center gap-1.5 text-xs text-subtle">
              <Icon name="sparkle" size={13} className="animate-dot" />
              返信案を考えています…
            </p>
            <div className="h-3 w-4/5 animate-shimmer rounded bg-hover" />
            <div className="h-3 w-3/5 animate-shimmer rounded bg-hover" />
          </div>
        )}

        {s.status === "error" && (
          <div className="flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad" role="alert">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1 break-words">返信案を作れませんでした{s.error ? `（${s.error}）` : ""}</span>
            <button type="button" className="shrink-0 font-medium underline" onClick={() => void regenerate(s.id)}>
              もう一度
            </button>
          </div>
        )}

        {s.status === "pending" && (
          <>
            {s.note && (
              <p className="mb-1.5 flex items-start gap-1.5 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
                <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                確認が必要です: {s.note}
              </p>
            )}
            <textarea
              ref={area}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={s.note ? "ここに返信を書けます" : "返信案"}
              aria-label={`${s.chatTitle} への返信`}
              className="w-full resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm leading-relaxed text-fg outline-none transition-colors focus:border-ink"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SendWithUndo
                target={s.chatTitle}
                disabled={!text.trim()}
                onSend={() => send(s.id, text)}
                onError={(e) => toast.error(errorText(e))}
              />
              <button
                type="button"
                onClick={() =>
                  putInInput(s.id, text).then(
                    () => toast.success(`「${s.chatTitle}」の入力欄に入れました（送信はされていません）`),
                    (e) => toast.error(errorText(e)),
                  )
                }
                disabled={!text.trim()}
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-fg transition-colors hover:bg-hover disabled:opacity-40"
              >
                入力欄に入れる
              </button>
              <button
                type="button"
                onClick={() => void regenerate(s.id)}
                className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-subtle transition-colors hover:bg-hover hover:text-fg"
              >
                <Icon name="refresh" size={12} />
                作り直す
              </button>
            </div>
          </>
        )}

        {sent && (
          <div className="flex items-start gap-2">
            <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-new-soft text-new">
              <Icon name="check" size={11} />
            </span>
            <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-muted">{s.draft}</p>
          </div>
        )}
      </div>
    </li>
  );
}

/** 受信トレイ。見張っているチャットに届いたメッセージと、AI が作った返信案が並ぶ */
export function InboxDialog({ onClose }: { onClose: () => void }) {
  const suggestions = useInboxStore((s) => s.suggestions);
  const watched = useInboxStore((s) => s.watched);
  const paused = useInboxStore((s) => s.paused);
  const setPaused = useInboxStore((s) => s.setPaused);
  const setWatch = useInboxStore((s) => s.setWatch);

  const todo = suggestions.filter((s) => s.status === "generating" || s.status === "pending" || s.status === "error");
  const done = suggestions.filter((s) => s.status === "sent");

  return (
    <Modal onClose={onClose} title="受信トレイ" width="max-w-2xl">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">自動で返信案を作る</p>
          <p className="text-xs text-subtle">
            {paused ? "一時停止中です" : watched.length === 0 ? "見張るチャットがありません" : `${watched.length} 件のチャットを見張っています`}
          </p>
        </div>
        <Switch checked={!paused} onChange={(on) => void setPaused(!on)} label="自動で返信案を作る" />
      </div>

      {watched.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-b border-line px-5 py-2.5" aria-label="見張っているチャット">
          {watched.map((w) => (
            <li key={w.chatID} className="flex items-center gap-1 rounded-full bg-hover py-0.5 pl-2.5 pr-1 text-xs text-muted">
              {w.title}
              <button
                type="button"
                aria-label={`${w.title} の見張りをやめる`}
                title="見張りをやめる"
                onClick={() => void setWatch(w, false)}
                className="flex size-4 items-center justify-center rounded-full text-subtle hover:bg-active hover:text-fg"
              >
                <Icon name="x" size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
        {todo.length === 0 && done.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-hover text-subtle">
              <Icon name="mail" size={22} />
            </div>
            <p className="text-sm font-medium text-fg">対応待ちの返信はありません</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-subtle">
              メッセージタブの「Beeper から取り込む」で、チャットの「自動で返信案を作る」をオンにすると、
              新しいメッセージが届くたびに、ここに返信案が並びます。送信は、ここで「送信」を押したときだけです。
            </p>
          </div>
        ) : (
          <>
            {todo.length > 0 && (
              <ul className="space-y-3" aria-label="対応待ち">
                {todo.map((s, i) => (
                  <SuggestionCard key={s.id} s={s} index={i} />
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 text-xs font-medium text-subtle">最近送信したもの</h3>
                <ul className="space-y-2">
                  {done.slice(0, 5).map((s, i) => (
                    <SuggestionCard key={s.id} s={s} index={i} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
