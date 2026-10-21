import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { ShortcutsDialog } from "./components/layout/ShortcutsDialog";
import { AppSkeleton } from "./components/Skeleton";
import { ToastHost } from "./components/ToastHost";
import { ChatPanel } from "./features/chat/ChatPanel";
import { ContextPanel } from "./features/context/ContextPanel";
import { InsightsDialog } from "./features/insights/InsightsDialog";
import { TaskListPanel } from "./features/tasks/TaskListPanel";
import { API_BASE } from "./lib/api";
import { useGlobalShortcuts } from "./lib/shortcuts";
import { useThemeEffect } from "./lib/useTheme";
import { useAppStore } from "./store/useAppStore";

// サーバーは Tauri / Vite が自動起動するが、立ち上がるまで数秒かかることがある
const RETRY_INTERVAL_MS = 2000;

function App() {
  const load = useAppStore((s) => s.load);
  const hydrate = useAppStore((s) => s.hydrate);
  const insightsOpen = useAppStore((s) => s.insightsOpen);
  const setInsightsOpen = useAppStore((s) => s.setInsightsOpen);
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);

  useThemeEffect();
  useGlobalShortcuts();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (load.status !== "error") return;
    const timer = setTimeout(() => void hydrate(), RETRY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [load, hydrate]);

  if (load.status !== "ready") {
    return (
      <>
        <AppSkeleton
          message="ローカルサーバーに接続しています…"
          hint={
            load.status === "error"
              ? `${API_BASE} に接続できません（${load.message}）。自動で再試行しています。起動しない場合は、ログ ~/.pm-hub/server.log を確認してください（開発中は npm run server でも起動できます）。`
              : undefined
          }
        />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <AppLayout left={<TaskListPanel />} center={<ChatPanel />} right={<ContextPanel />} />
      {insightsOpen && <InsightsDialog onClose={() => setInsightsOpen(false)} />}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      <ToastHost />
    </>
  );
}

export default App;
