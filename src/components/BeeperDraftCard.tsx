import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "../store/toastStore";
import type { BeeperRecipient } from "../types";
import { parseBeeperDraft, type BeeperDraft } from "../utils/gmailDraft";
import { Icon } from "./Icon";
import { SendWithUndo } from "./SendWithUndo";

/** AI の宛先を Beeper と照合してから、下書き保存・送信を許可する。 */
export function BeeperDraftCard({ source }: { source: string }) {
  const parsed = parseBeeperDraft(source);
  if (!parsed) return null;
  // ストリーミングなどで宛先が変わったら、確認状態と送信待ちタイマーを破棄する。
  return <RecipientDraftCard key={JSON.stringify([parsed.chat, parsed.id])} draft={parsed} />;
}

function RecipientDraftCard({ draft }: { draft: BeeperDraft }) {
  const [text, setText] = useState(draft.text);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [recipient, setRecipient] = useState<BeeperRecipient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setRecipient(null);
    setError(null);
    api.beeperRecipient({ chat: draft.chat, chatID: draft.id }).then(
      (value) => { if (active) setRecipient(value); },
      (err) => { if (active) setError(err instanceof Error ? err.message : String(err)); },
    );
    return () => { active = false; };
  }, [draft.chat, draft.id, attempt]);

  const target = recipient ? `${recipient.title}（${recipient.network || "Beeper"} / ${recipient.id}）` : draft.chat;
  const destination = () => {
    if (!recipient) throw new Error("送信先を確認できていません");
    return { chat: recipient.title, chatID: recipient.id, network: recipient.network };
  };

  const save = async () => {
    setState("saving");
    try {
      await api.beeperDraft({ ...destination(), text });
      setState("saved");
      toast.success(`「${target}」の入力欄に入れました（送信はされていません）`);
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="not-prose my-3 space-y-1.5 rounded-xl border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Icon name="chat" size={12} />
        {recipient?.title ?? draft.chat} への返信案
      </p>
      {recipient ? (
        <p className="break-all text-[11px] text-muted">送信先: {target}</p>
      ) : error ? (
        <div role="alert" className="text-xs text-bad">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-1 underline">送信先を再確認</button>
        </div>
      ) : (
        <p role="status" className="text-xs text-muted">Beeper の送信先を確認しています…</p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(8, text.split("\n").length + 1)}
        aria-label="文面"
        className="w-full resize-y rounded-md border border-line bg-hover px-2 py-1 text-xs text-fg outline-none focus:border-ink"
      />
      <button
        type="button"
        onClick={save}
        disabled={!recipient || state !== "idle" || !text.trim()}
        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-opacity disabled:opacity-40"
      >
        {state === "saved" ? "入れました" : state === "saving" ? "入れています…" : "Beeper の下書きに入れる"}
      </button>
      <span className="ml-2 inline-block align-middle">
        <SendWithUndo
          target={target}
          disabled={!recipient || !text.trim()}
          onSend={async () => {
            await api.beeperSend({ ...destination(), text });
          }}
          onError={(err) => toast.error(err instanceof Error ? err.message : String(err))}
        />
      </span>
    </div>
  );
}
