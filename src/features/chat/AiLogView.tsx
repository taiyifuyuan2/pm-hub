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
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
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
      <div ref={scrollRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
        {logs.length === 0 ? (
          empty
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-5">
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

      {!stuck && (
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
    <div className="flex animate-fade-up items-start gap-2 pl-9 font-mono text-[11px] text-subtle">
      <Icon name="gear" size={12} className="mt-0.5 shrink-0" />
      <span className="break-all">{log.message}</span>
    </div>
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
    <div className={`ml-9 animate-fade-up rounded-xl border bg-raised p-3 text-sm ${tone.border}`}>
      <div className="flex items-center gap-2 text-xs">
        {!decision && <span className="size-2 animate-pulse rounded-full bg-warn" />}
        <span className={`flex items-center gap-1 font-medium ${tone.title}`}>
          <Icon name={tone.icon} size={13} />
          {tone.label}
        </span>
        <span className="rounded bg-hover px-1.5 py-px font-mono text-muted">{permission.toolName}</span>
      </div>

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
            {error && <span className="text-xs text-bad">{error}</span>}
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
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="考え中">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-dot rounded-full bg-subtle" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
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
      <div className="group flex animate-fade-up flex-col items-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm leading-relaxed text-on-ink">
          {log.message}
        </div>
        <span className="mt-1 text-[11px] text-subtle" title={formatDateTime(log.timestamp)}>
          {formatRelative(log.timestamp)}
        </span>
      </div>
    );
  }

  return (
    <div className="group flex animate-fade-up gap-3">
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-hover text-fg"
        aria-hidden="true"
      >
        <Icon name="sparkle" size={13} />
      </span>
      <div className="min-w-0 flex-1">
        {isThinking ? (
          <TypingDots />
        ) : isError ? (
          <p className="whitespace-pre-wrap break-words rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{log.message}</p>
        ) : (
          <div className="text-sm leading-relaxed">
            <Markdown>{log.message}</Markdown>
            {streaming && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-fg" aria-hidden="true" />}
          </div>
        )}
        {!isThinking && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-subtle">
            <span title={formatDateTime(log.timestamp)}>Claude · {formatRelative(log.timestamp)}</span>
            {streaming && <span className="font-medium text-info">応答中</span>}
            {!isError && !streaming && (
              <button
                onClick={copy}
                className="flex items-center gap-1 rounded px-1 py-0.5 opacity-0 hover:bg-hover hover:text-fg focus:opacity-100 group-hover:opacity-100"
                aria-label="この返答をコピー"
              >
                <Icon name={copied ? "check" : "copy"} size={12} />
                {copied ? "コピー済み" : "コピー"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
