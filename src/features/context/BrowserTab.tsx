import { Icon } from "../../components/Icon";

// Tauri の WebView 埋め込みは後続フェーズで実装する。いまは、完成後の形が分かる「準備中」の表示にしておく
export function BrowserTab() {
  return (
    <div className="flex flex-1 flex-col p-3">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-hover px-3 py-2 text-xs text-subtle" aria-hidden="true">
        <Icon name="globe" size={14} />
        <span className="truncate">https://</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-hover text-subtle">
          <Icon name="globe" size={22} />
        </div>
        <p className="text-sm font-medium text-fg">ブラウザは準備中です</p>
        <p className="mt-1 text-xs leading-relaxed text-subtle">
          タスクに関連するページを、ここに開いて参照できるようにする予定です。
        </p>
      </div>
    </div>
  );
}
