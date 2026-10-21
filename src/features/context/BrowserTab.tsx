import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// タブやタスクを切り替えるとこのコンポーネントは作り直される。開いていたページを覚えておく
let lastUrl = "";

/** 入力を http(s) の URL にする。ドメインらしくなければ検索にする */
function toUrl(input: string): string {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[^\s/]+\.[^\s/]+(\/.*)?$/.test(text) || /^localhost(:\d+)?(\/.*)?$/i.test(text)) return `https://${text}`;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}

export function BrowserTab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState(lastUrl);
  const [opened, setOpened] = useState(lastUrl !== "");
  const [error, setError] = useState<string | null>(null);

  const bounds = useCallback(() => {
    const r = hostRef.current?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null;
  }, []);

  // 表示中は、プレースホルダーの位置とサイズに子 WebView を合わせる
  useEffect(() => {
    if (!inTauri || !opened) return;
    const host = hostRef.current;
    if (!host) return;
    const sync = () => {
      const b = bounds();
      if (b) invoke("browser_set_bounds", { bounds: b }).catch(() => {});
    };
    const observer = new ResizeObserver(sync);
    observer.observe(host);
    window.addEventListener("resize", sync);
    // パネルの幅変更（ドラッグ）で位置だけ動く場合に備える
    const timer = window.setInterval(sync, 250);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      window.clearInterval(timer);
    };
  }, [opened, bounds]);

  // ページ内の移動（リンクのクリックなど）をアドレスバーに反映する
  useEffect(() => {
    if (!inTauri) return;
    const unlisten = listen<string>("browser-url", (e) => {
      lastUrl = e.payload;
      setInput(e.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // 開いているときは表示し直し、離れるときは隠す（ページは残る）
  useEffect(() => {
    if (!inTauri || !opened) return;
    const b = bounds();
    if (b) invoke("browser_show", { url: null, bounds: b }).catch(() => {});
    return () => {
      invoke("browser_hide").catch(() => {});
    };
  }, [opened, bounds]);

  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const url = toUrl(input);
    const b = bounds();
    if (!b) return;
    try {
      await invoke("browser_show", { url, bounds: b });
      lastUrl = url;
      setInput(url);
      setError(null);
      setOpened(true);
    } catch (err) {
      setError(String(err));
    }
  };

  const act = (action: "back" | "forward" | "reload") => {
    invoke("browser_eval", { action }).catch((err) => setError(String(err)));
  };

  const btn =
    "flex size-7 shrink-0 items-center justify-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={go} className="flex shrink-0 items-center gap-1 p-2">
        <button type="button" className={btn} disabled={!opened} onClick={() => act("back")} aria-label="戻る">
          <Icon name="chevronLeft" size={16} />
        </button>
        <button type="button" className={btn} disabled={!opened} onClick={() => act("forward")} aria-label="進む">
          <Icon name="chevronRight" size={16} />
        </button>
        <button type="button" className={btn} disabled={!opened} onClick={() => act("reload")} aria-label="再読み込み">
          <Icon name="refresh" size={14} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          placeholder="URL または検索ワード"
          aria-label="アドレス"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-line bg-hover px-3 py-1.5 text-xs text-fg outline-none focus:border-ink"
        />
      </form>
      {error && <p className="px-3 pb-1 text-xs text-red-500">{error}</p>}
      <div ref={hostRef} className="relative min-h-0 flex-1">
        {!opened && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-hover text-subtle">
              <Icon name="globe" size={22} />
            </div>
            <p className="text-sm font-medium text-fg">
              {inTauri ? "URL を入力して開きます" : "ブラウザはデスクトップアプリでのみ使えます"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-subtle">
              タスクに関連するページを、ここに開いて参照できます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
