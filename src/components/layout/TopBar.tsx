import { useInboxStore } from "../../store/inboxStore";
import { useAppStore } from "../../store/useAppStore";
import { NEXT_THEME, THEME_LABEL } from "../../lib/useTheme";
import { Icon, type IconName } from "../Icon";
import { CategoryTabs } from "./CategoryTabs";

const THEME_ICON: Record<"auto" | "light" | "dark", IconName> = { auto: "monitor", light: "sun", dark: "moon" };

interface TopBarProps {
  showLeft: boolean;
  showRight: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

const iconButton =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-hover hover:text-fg";

/** アプリの上部バー。左右パネルの開閉、カテゴリのタブ、概要・ショートカット・テーマ・更新のボタンを持つ */
export function TopBar({ showLeft, showRight, onToggleLeft, onToggleRight }: TopBarProps) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const refresh = useAppStore((s) => s.refresh);
  const refreshing = useAppStore((s) => s.refreshing);
  const setInsightsOpen = useAppStore((s) => s.setInsightsOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
  const setInboxOpen = useInboxStore((s) => s.setOpen);
  const waiting = useInboxStore((s) => s.suggestions.filter((x) => x.status === "pending" || x.status === "generating").length);

  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-canvas px-2">
      <button
        onClick={onToggleLeft}
        aria-label="左パネルの表示切替"
        aria-pressed={showLeft}
        title="タスク一覧の表示・非表示"
        className={`${iconButton} hidden lg:flex ${showLeft ? "text-fg" : ""}`}
      >
        <Icon name="panelLeft" size={16} />
      </button>

      <div className="flex shrink-0 items-center gap-2 px-1.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-ink text-xs font-bold text-on-ink" aria-hidden="true">
          P
        </span>
        <span className="hidden text-sm font-semibold tracking-tight text-fg sm:inline">PM Hub</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center">
        <CategoryTabs />
      </div>

      <button
        onClick={() => void refresh().catch(() => {})}
        aria-label="更新"
        title="最新の状態に更新"
        className={iconButton}
      >
        <Icon name="refresh" size={16} className={refreshing ? "animate-spin-slow" : ""} />
      </button>
      <button
        onClick={() => setInboxOpen(true)}
        aria-label={waiting > 0 ? `受信トレイを開く（対応待ち ${waiting} 件）` : "受信トレイを開く"}
        title="受信トレイ（Alt+M）"
        className={`${iconButton} relative`}
      >
        <Icon name="inbox" size={16} />
        {waiting > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 animate-pop items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-4 text-on-ink">
            {waiting}
          </span>
        )}
      </button>
      <button onClick={() => setInsightsOpen(true)} aria-label="概要を開く" title="概要（Alt+I）" className={iconButton}>
        <Icon name="chart" size={16} />
      </button>
      <button onClick={() => setShortcutsOpen(true)} aria-label="ショートカット一覧" title="ショートカット（?）" className={`${iconButton} hidden sm:flex`}>
        <Icon name="keyboard" size={16} />
      </button>
      <button
        onClick={() => setTheme(NEXT_THEME[theme])}
        aria-label={`テーマ: ${THEME_LABEL[theme]}（押すと切り替え）`}
        title={`テーマ: ${THEME_LABEL[theme]}（Alt+T で切り替え）`}
        className={iconButton}
      >
        <Icon name={THEME_ICON[theme]} size={16} />
      </button>
      <button
        onClick={onToggleRight}
        aria-label="右パネルの表示切替"
        aria-pressed={showRight}
        title="コンテキストの表示・非表示"
        className={`${iconButton} hidden lg:flex ${showRight ? "text-fg" : ""}`}
      >
        <Icon name="panelRight" size={16} />
      </button>
    </header>
  );
}
