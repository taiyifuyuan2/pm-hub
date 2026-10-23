import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useWindowWidth } from "../../lib/useWindowWidth";
import { PANEL_WIDTH, fitPanelWidths, maxPanelWidth } from "../../utils/layout";
import { Icon, type IconName } from "../Icon";
import { ResizeHandle } from "./ResizeHandle";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";

type Pane = "left" | "center" | "right";

interface AppLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

const PANE_TABS: Record<Pane, { label: string; icon: IconName }> = {
  left: { label: "タスク", icon: "list" },
  center: { label: "AIと進める", icon: "chat" },
  right: { label: "メモ・資料", icon: "note" },
};

/**
 * 3列レイアウトのシェル。
 * - lg (>=1024px) 以上: 左 / 中央 / 右 を横並び。左右は開閉でき、境界線をドラッグして幅を変えられる（幅は保存される）
 * - lg 未満: 1列表示に切り替え、下部タブでペインを切り替える
 */
export function AppLayout({ left, center, right }: AppLayoutProps) {
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [mobilePane, setMobilePane] = useState<Pane>("center");
  const leftWidth = useAppStore((s) => s.leftWidth);
  const rightWidth = useAppStore((s) => s.rightWidth);
  const setLeftWidth = useAppStore((s) => s.setLeftWidth);
  const setRightWidth = useAppStore((s) => s.setRightWidth);
  const windowWidth = useWindowWidth();
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const previousTaskId = useRef(selectedTaskId);
  useEffect(() => {
    if (selectedTaskId && selectedTaskId !== previousTaskId.current && windowWidth < 1024) setMobilePane("center");
    previousTaskId.current = selectedTaskId;
  }, [selectedTaskId, windowWidth]);

  // 保存された幅は変えず、表示のときだけ、中央に最小幅を残すよう縮める（ウィンドウを広げれば元の幅に戻る）
  // いま広げられる上限。ドラッグ中は、見えている幅を基準に、この上限までしか動かさない
  const leftMax = maxPanelWidth("left", windowWidth, { width: rightWidth, visible: showRight });
  const rightMax = maxPanelWidth("right", windowWidth, { width: leftWidth, visible: showLeft });
  const fitted = fitPanelWidths(windowWidth, { width: leftWidth, visible: showLeft }, { width: rightWidth, visible: showRight });

  // lg 未満では mobilePane のみ表示、lg 以上では開閉フラグに従う
  const paneClass = (pane: Pane, visibleOnDesktop: boolean) =>
    [mobilePane === pane ? "flex" : "hidden", visibleOnDesktop ? "lg:flex" : "lg:hidden"].join(" ");

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar
        showLeft={showLeft}
        showRight={showRight}
        onToggleLeft={() => setShowLeft((v) => !v)}
        onToggleRight={() => setShowRight((v) => !v)}
        onToggleFocus={() => {
          const restore = !showLeft && !showRight;
          setShowLeft(restore);
          setShowRight(restore);
        }}
      />

      <div className="flex min-h-0 flex-1">
        <aside
          style={{ ["--pane-w" as string]: `${fitted.left}px` } as CSSProperties}
          aria-label="タスク一覧"
          className={`${paneClass("left", showLeft)} w-full min-w-0 flex-col bg-sidebar lg:w-(--pane-w) lg:shrink-0`}
        >
          {left}
        </aside>
        {showLeft && (
          <ResizeHandle
            side="left"
            label="左パネルの幅"
            width={fitted.left}
            min={PANEL_WIDTH.left.min}
            max={leftMax}
            defaultWidth={PANEL_WIDTH.left.default}
            onChange={setLeftWidth}
          />
        )}

        <main aria-label="AIとの会話" className={`${paneClass("center", true)} min-w-0 flex-1 flex-col bg-surface`}>{center}</main>

        {showRight && (
          <ResizeHandle
            side="right"
            label="右パネルの幅"
            width={fitted.right}
            min={PANEL_WIDTH.right.min}
            max={rightMax}
            defaultWidth={PANEL_WIDTH.right.default}
            onChange={setRightWidth}
          />
        )}
        <aside
          style={{ ["--pane-w" as string]: `${fitted.right}px` } as CSSProperties}
          aria-label="タスクの資料"
          className={`${paneClass("right", showRight)} w-full min-w-0 flex-col bg-sidebar lg:w-(--pane-w) lg:shrink-0`}
        >
          {right}
        </aside>
      </div>

      <StatusBar />

      <nav className="flex shrink-0 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="表示の切り替え">
        {(Object.keys(PANE_TABS) as Pane[]).map((pane) => {
          const active = mobilePane === pane;
          return (
            <button
              key={pane}
              onClick={() => setMobilePane(pane)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 border-t-2 py-2 text-[11px] font-medium ${
                active ? "border-ink bg-info-soft text-info" : "border-transparent text-subtle hover:text-muted"
              }`}
            >
              <Icon name={PANE_TABS[pane].icon} size={18} />
              {PANE_TABS[pane].label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
