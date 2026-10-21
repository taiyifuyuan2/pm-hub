import { useState } from "react";
import { api } from "../lib/api";
import { toast } from "../store/toastStore";
import { parseBeeperDraft } from "../utils/gmailDraft";
import { Icon } from "./Icon";
import { SendWithUndo } from "./SendWithUndo";

/** AI が作った返信文。確認・編集して、相手とのチャットの入力欄（Beeper）に入れられる。送信はしない */
export function BeeperDraftCard({ source }: { source: string }) {
  const parsed = parseBeeperDraft(source);
  const [text, setText] = useState(parsed?.text ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  if (!parsed) return null;

  const save = async () => {
    setState("saving");
    try {
      await api.beeperDraft({ chat: parsed.chat, text });
      setState("saved");
      toast.success(`「${parsed.chat}」の入力欄に入れました（送信はされていません）`);
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="not-prose my-3 space-y-1.5 rounded-xl border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Icon name="chat" size={12} />
        {parsed.chat} への返信案
      </p>
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
        disabled={state !== "idle" || !text.trim()}
        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-opacity disabled:opacity-40"
      >
        {state === "saved" ? "入れました" : state === "saving" ? "入れています…" : "Beeper の下書きに入れる"}
      </button>
      <span className="ml-2 inline-block align-middle">
        <SendWithUndo
          target={parsed.chat}
          disabled={!text.trim()}
          onSend={async () => {
            await api.beeperSend({ chat: parsed.chat, text });
          }}
          onError={(err) => toast.error(err instanceof Error ? err.message : String(err))}
        />
      </span>
    </div>
  );
}
