import { useAppStore } from "../../store/useAppStore";
import { NEXT_THEME, THEME_LABEL } from "../../lib/useTheme";
import { Icon, type IconName } from "../Icon";
import { CategoryTabs } from "./CategoryTabs";
import { ProjectTabs } from "./ProjectTabs";

const THEME_ICON: Record<"auto" | "light" | "dark", IconName> = { auto: "monitor", light: "sun", dark: "moon" };

interface TopBarProps {
  showLeft: boolean;
  showRight: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleFocus: () => void;
}

const iconButton =
  "flex size-9 shrink-0 items-center justify-center rounded-xl text-subtle transition-colors hover:bg-hover hover:text-fg disabled:opacity-50";

/** アプリの上部バー。左右パネルの開閉、カテゴリのタブ、概要・ショートカット・テーマ・更新のボタンを持つ */
export function TopBar({ showLeft, showRight, onToggleLeft, onToggleRight, onToggleFocus }: TopBarProps) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const refresh = useAppStore((s) => s.refresh);
  const refreshing = useAppStore((s) => s.refreshing);
  const setInsightsOpen = useAppStore((s) => s.setInsightsOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
  const requestNewTask = useAppStore((s) => s.requestNewTask);
  const openVice = useAppStore((s) => s.openVice);
  const focused = !showLeft && !showRight;

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="flex h-16 items-center gap-1 px-3 sm:gap-2 sm:px-5">
      <button
        onClick={onToggleLeft}
        aria-label="左パネルの表示切替"
        aria-pressed={showLeft}
        title="タスク一覧の表示・非表示"
        className={`${iconButton} hidden lg:flex ${showLeft ? "text-fg" : ""}`}
      >
        <Icon name="panelLeft" size={16} />
      </button>

      <div className="flex shrink-0 items-center gap-2.5 pr-2 sm:pr-5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-on-ink shadow-sm" aria-hidden="true">
          <Icon name="folder" size={20} />
        </span>
        <div>
          <span className="block text-base font-bold tracking-tight text-fg">PM Hub</span>
          <span className="hidden text-[10px] tracking-wide text-subtle sm:block">自分と AI のワークスペース</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center">
        <button onClick={onToggleFocus} aria-pressed={focused} title="左右のパネルを閉じて会話に集中" className={`hidden items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium lg:flex ${focused ? "bg-info-soft text-info" : "text-muted hover:bg-hover"}`}>
          <Icon name="chat" size={15} />{focused ? "全体を表示" : "集中モード"}
        </button>
        <button
          onClick={openVice}
          title="Vice に相談する"
          aria-label="Vice に相談する"
          className="ml-1 hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-muted hover:bg-hover hover:text-fg sm:flex"
        >
          <Icon name="sparkle" size={15} />Vice
        </button>
      </div>

      <button
        onClick={() => void refresh().catch(() => {})}
        aria-label="更新"
        title="最新の状態に更新"
        disabled={refreshing}
        className={iconButton}
      >
        <Icon name="refresh" size={16} className={refreshing ? "animate-spin-slow" : ""} />
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
      <button onClick={requestNewTask} className="ml-1 flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-xs font-semibold text-on-ink shadow-sm transition-opacity hover:opacity-90" title="新規タスク（Ctrl+N）" aria-label="新規タスクを作成">
        <Icon name="plus" size={16} /><span className="hidden sm:inline">新規タスク</span>
      </button>
      </div>
      <div className="flex min-h-11 items-center border-t border-line/70 bg-sidebar px-3 sm:px-5">
        <span className="hidden shrink-0 pr-3 text-[11px] font-medium text-subtle sm:block">カテゴリ</span>
        <CategoryTabs />
        <span className="mx-2 hidden h-4 w-px shrink-0 bg-line sm:block" />
        <ProjectTabs />
      </div>
    </header>
  );
}
