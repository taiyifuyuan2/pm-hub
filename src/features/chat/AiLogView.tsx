import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { Markdown } from "../../components/Markdown";
import { copyText } from "../../lib/clipboard";
import { toast } from "../../store/toastStore";
import type { AiLog } from "../../types";
import { formatDateTime, formatRelative } from "../../utils/format";
import { respondPermission } from "./runAgent";

/** この距離（px）以内なら「最新を見ている」とみなし、新しい発言で自動スクロールする */
const STICK_THRESHOLD = 80;

interface AiLogViewProps {
  taskId: string;
  logs: AiLog[];
  /** ログが空のときに出す内容 */
  empty: React.ReactNode;
}

/**
 * チャットの履歴。
 * - 最新を見ているときだけ自動で下までスクロールする。上へ遡っているときは動かさず、「最新へ」ボタンを出す
 * - 返答の途中（ストリーミング）でも、見ている位置を奪わない
 */
export function AiLogView({ taskId, logs, empty }: AiLogViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);
  const stuckRef = useRef(true);
  const [hasNew, setHasNew] = useState(false);

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: logs.length ? el.scrollHeight : 0, behavior: smooth ? "smooth" : "auto" });
  };

  // タスクを切り替えたら、一番下から見せる
  useLayoutEffect(() => {
    stuckRef.current = true;
    setStuck(true);
    setHasNew(false);
    scrollToBottom();
  }, [taskId]);

  useLayoutEffect(() => {
    if (stuckRef.current) scrollToBottom();
    else setHasNew(true);
  }, [logs]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
    stuckRef.current = near;
    setStuck(near);
    if (near) setHasNew(false);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} role="region" aria-label="会話履歴" tabIndex={0} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6">
        {logs.length === 0 ? (
          empty
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {logs.map((log) =>
              log.kind === "tool" ? (
                <ToolLine key={log.id} log={log} />
              ) : log.kind === "permission" ? (
                <PermissionCard key={log.id} taskId={taskId} log={log} />
              ) : (
                <Message key={log.id} log={log} />
              ),
            )}
          </div>
        )}
      </div>

      {logs.length > 0 && !stuck && (
        <button
          onClick={() => {
            scrollToBottom(true);
            setHasNew(false);
          }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 animate-pop items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-on-ink shadow-pop"
          aria-label="最新のメッセージへ移動"
        >
          <Icon name="arrowDown" size={13} />
          {hasNew ? "新しいメッセージ" : "最新へ"}
        </button>
      )}
    </div>
  );
}

/** エージェントがツールを使った記録。目立たせず、1行で見せる */
function ToolLine({ log }: { log: AiLog }) {
  return (
    <details className="ml-9 animate-fade-up rounded-lg border border-line bg-raised text-xs text-subtle">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:text-fg">
        <Icon name="gear" size={13} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono">{log.message}</span>
        <span className="shrink-0 text-[10px]">実行内容</span>
        <Icon name="chevronDown" size={12} className="shrink-0" />
      </summary>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all border-t border-line px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted">{log.message}</pre>
    </details>
  );
}

type Answer = "allow" | "always" | "deny";

function PermissionCard({ taskId, log }: { taskId: string; log: AiLog }) {
  const permission = log.permission!;
  const [sending, setSending] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decision = permission.decision;

  const answer = async (value: Answer) => {
    setSending(value);
    setError(null);
    try {
      await respondPermission(taskId, permission.requestId, value === "deny" ? "deny" : "allow", value === "always");
      // カードの表示はサーバーから permission_resolved が届いた時点で更新される
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSending(null);
    }
  };

  const tone = !decision
    ? { border: "border-warn/50", title: "text-warn", icon: "alert" as const, label: "許可を求めています" }
    : decision === "deny"
      ? { border: "border-bad/40", title: "text-bad", icon: "x" as const, label: "拒否しました" }
      : permission.auto
        ? { border: "border-line-strong", title: "text-muted", icon: "sparkle" as const, label: "自動許可しました" }
        : { border: "border-new/40", title: "text-new", icon: "check" as const, label: "許可しました" };

  return (
    <div id={`permission-${log.id}`} tabIndex={-1} aria-label={tone.label} aria-busy={sending !== null && !decision} className={`ml-9 animate-fade-up rounded-xl border bg-raised p-4 text-sm ${tone.border}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!decision && <span className="size-2 animate-pulse rounded-full bg-warn" />}
        <span className={`flex items-center gap-1 font-medium ${tone.title}`}>
          <Icon name={tone.icon} size={13} />
          {tone.label}
        </span>
        <span className="rounded bg-hover px-1.5 py-px font-mono text-muted">{permission.toolName}</span>
      </div>

      {!decision && <p className="mt-2 text-xs leading-relaxed text-muted">以下の操作を確認してください。許可すると、Claude が作業を続けます。</p>}

      {log.message && <p className="mt-2 break-all font-mono text-xs text-fg">{log.message}</p>}
      {permission.detail && (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-hover p-2.5 font-mono text-[11px] leading-relaxed text-muted">
          {permission.detail}
        </pre>
      )}

      {decision === "allow" && permission.rule && (
        <p className="mt-2 text-[11px] text-subtle">
          {permission.remembered ? "このセッションでは常に許可に登録: " : "ルールに合致: "}
          <span className="font-mono text-muted">{permission.rule}</span>
        </p>
      )}

      {!decision && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => answer("allow")}
              disabled={sending !== null}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-on-ink hover:opacity-90 disabled:opacity-50"
            >
              {sending === "allow" ? "送信中…" : "今回のみ許可"}
            </button>
            {permission.suggestedRule && (
              <button
                onClick={() => answer("always")}
                disabled={sending !== null}
                className="rounded-lg bg-new-soft px-3 py-1.5 text-xs font-medium text-new hover:opacity-90 disabled:opacity-50"
              >
                {sending === "always" ? "送信中…" : "このセッションでは常に許可"}
              </button>
            )}
            <button
              onClick={() => answer("deny")}
              disabled={sending !== null}
              className="rounded-lg bg-hover px-3 py-1.5 text-xs font-medium text-fg hover:bg-active disabled:opacity-50"
            >
              {sending === "deny" ? "送信中…" : "拒否"}
            </button>
            {error && <span role="alert" className="text-xs text-bad">{error}</span>}
          </div>
          {permission.suggestedRule && (
            <p className="text-[11px] text-subtle">
              常に許可の対象: <span className="font-mono text-muted">{permission.suggestedRule}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** 入力中を示す、3つの点が順に跳ねるアニメーション */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1" role="status" aria-label="Claude が考えています">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-dot rounded-full bg-subtle" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
      <span className="ml-2 text-xs text-subtle" aria-hidden="true">考えています…</span>
    </span>
  );
}

function Message({ log }: { log: AiLog }) {
  const isUser = log.sender === "user";
  const isError = log.status === "error";
  const isThinking = log.status === "running" && !log.message;
  const streaming = log.status === "running" && !!log.message;
  const [copied, setCopied] = useState(false);

  // 経過時間の表示（「3分前」）が古くならないよう、1分ごとに再描画する
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const copy = async () => {
    if (!(await copyText(log.message))) return;
    setCopied(true);
    toast.success("コピーしました", { durationMs: 1500 });
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <article className="group flex animate-fade-up flex-col items-end" aria-label="あなたのメッセージ">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-subtle">
          <span className="font-semibold text-muted">あなた</span>
          <span title={formatDateTime(log.timestamp)}>{formatRelative(log.timestamp)}</span>
        </div>
        <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md border border-new/15 bg-new-soft px-4 py-3 text-sm leading-7 text-fg">
          {log.message}
        </div>
      </article>
    );
  }

  return (
    <article className="group flex animate-fade-up gap-3" aria-label="Claude のメッセージ">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-new/20 bg-new-soft text-new"
        aria-hidden="true"
      >
        <Icon name="sparkle" size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex min-h-7 items-center gap-2 text-[11px] text-subtle">
          <span className="text-xs font-semibold text-fg">Claude</span>
          <span className="rounded border border-line px-1.5 py-px text-[9px] font-medium">AI</span>
          <span title={formatDateTime(log.timestamp)}>{formatRelative(log.timestamp)}</span>
          {streaming && <span className="font-medium text-new">応答中</span>}
        </div>
        {isThinking ? (
          <TypingDots />
        ) : isError ? (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-bad/20 bg-bad-soft px-3.5 py-3 text-sm text-bad">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <p className="whitespace-pre-wrap break-words leading-relaxed">{log.message}</p>
          </div>
        ) : (
          <div className="text-sm leading-7">
            <Markdown>{log.message}</Markdown>
            {streaming && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-fg" aria-hidden="true" />}
          </div>
        )}
        {!isThinking && !isError && !streaming && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-subtle">
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-hover hover:text-fg"
                aria-label="この返答をコピー"
              >
                <Icon name={copied ? "check" : "copy"} size={12} />
                {copied ? "コピー済み" : "コピー"}
              </button>
          </div>
        )}
      </div>
    </article>
  );
}
