import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { copyText } from "../lib/clipboard";
import { BeeperDraftCard } from "./BeeperDraftCard";
import { GmailDraftCard } from "./GmailDraftCard";
import { Icon } from "./Icon";
import { ViceTaskCard } from "./ViceTaskCard";

/** コードブロック。右上のボタンで全体をコピーできる */
function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  // react-markdown は <pre><code>…</code></pre> を渡してくる。表示中のテキストをそのままコピーする
  const textOf = (node: ReactNode): string =>
    typeof node === "string" ? node : Array.isArray(node) ? node.map(textOf).join("") : node && typeof node === "object" && "props" in node ? textOf((node as { props: { children?: ReactNode } }).props.children) : "";

  const copy = async () => {
    if (await copyText(textOf(children).replace(/\n$/, ""))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="group/code relative">
      <pre>{children}</pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "コピーしました" : "コードをコピー"}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-raised px-1.5 py-1 text-[11px] text-muted opacity-0 shadow-sm ring-1 ring-line transition-opacity hover:text-fg focus:opacity-100 group-hover/code:opacity-100"
      >
        <Icon name={copied ? "check" : "copy"} size={12} />
        {copied ? "コピー済み" : "コピー"}
      </button>
    </div>
  );
}

/** GFM（表・チェックリスト・取り消し線など）対応の Markdown 表示。色はテーマに追従する */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-sm prose-themed max-w-none prose-pre:my-3 prose-pre:rounded-lg prose-pre:border prose-pre:border-line ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          pre: ({ node, children }) => {
            // ```gmail-draft は、保存ボタン付きの下書きカードにする
            const code = node?.children[0];
            if (code?.type === "element" && Array.isArray(code.properties?.className) && code.properties.className.includes("language-gmail-draft")) {
              const text = code.children.map((c) => (c.type === "text" ? c.value : "")).join("");
              return <GmailDraftCard source={text} />;
            }
            if (code?.type === "element" && Array.isArray(code.properties?.className) && code.properties.className.includes("language-beeper-draft")) {
              const text = code.children.map((c) => (c.type === "text" ? c.value : "")).join("");
              return <BeeperDraftCard source={text} />;
            }
            if (code?.type === "element" && Array.isArray(code.properties?.className) && code.properties.className.includes("language-vice-tasks")) {
              const text = code.children.map((c) => (c.type === "text" ? c.value : "")).join("");
              return <ViceTaskCard source={text} />;
            }
            return <CodeBlock>{children}</CodeBlock>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
