import { useState } from "react";
import { api } from "../lib/api";
import { toast } from "../store/toastStore";
import { parseGmailDraft } from "../utils/gmailDraft";
import { Icon } from "./Icon";

const field = "w-full rounded-md border border-line bg-hover px-2 py-1 text-xs text-fg outline-none focus:border-ink";

/** AI が作った返信文。内容を確認・編集して、Gmail の下書きに保存できる（送信はしない） */
export function GmailDraftCard({ source }: { source: string }) {
  const parsed = parseGmailDraft(source);
  const [to, setTo] = useState(parsed?.to ?? "");
  const [subject, setSubject] = useState(parsed?.subject ?? "");
  const [body, setBody] = useState(parsed?.body ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  if (!parsed) return null;

  const save = async () => {
    setState("saving");
    try {
      await api.gmailDraft({ to, subject, body });
      setState("saved");
      toast.success("Gmail の下書きに保存しました（送信はされていません）");
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="not-prose my-3 space-y-1.5 rounded-xl border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Icon name="mail" size={12} />
        メールの下書き
      </p>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="宛先" aria-label="宛先" className={field} />
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="件名" aria-label="件名" className={field} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(12, body.split("\n").length + 1)} aria-label="本文" className={`${field} resize-y`} />
      <button
        type="button"
        onClick={save}
        disabled={state !== "idle" || !to.trim() || !body.trim()}
        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-opacity disabled:opacity-40"
      >
        {state === "saved" ? "保存しました" : state === "saving" ? "保存中…" : "Gmail の下書きに保存"}
      </button>
      {!to.trim() && state === "idle" && <p className="text-[11px] text-subtle">宛先を入れると保存できます</p>}
    </div>
  );
}
