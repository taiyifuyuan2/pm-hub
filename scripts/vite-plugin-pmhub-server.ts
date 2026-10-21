import { spawn, type ChildProcess } from "node:child_process";
import type { Plugin } from "vite";

const PORT = Number(process.env.PMHUB_PORT ?? 3001);
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;

// Vite は設定変更時に再起動し、このモジュールも読み直される。
// 子プロセスはモジュール変数ではなく globalThis に置き、再起動をまたいで1つだけ保持する。
const globalState = globalThis as typeof globalThis & { __pmHubServer?: ChildProcess };

/** ポートで動いているのが PM Hub サーバーかどうか（別アプリが使っていても誤認しない） */
async function isServerRunning() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(800) });
    return res.ok && (await res.json())?.ok === true;
  } catch {
    return false;
  }
}

/**
 * `vite`（npm run dev / tauri dev）の起動時にローカルサーバーを子プロセスとして立ち上げる。
 * - 既に起動していれば何もしない（npm run server で手動起動した場合など）
 * - Vite プロセスの終了時に kill。kill できずに Vite が落ちても、
 *   サーバー側が PMHUB_PARENT_PID を監視して自分で終了する
 * - PMHUB_NO_AUTOSTART=1 で無効化
 */
export function pmHubServer(): Plugin {
  return {
    name: "pm-hub-server",
    apply: "serve",
    async configureServer(server) {
      if (process.env.PMHUB_NO_AUTOSTART) return;
      const logger = server.config.logger;

      const existing = globalState.__pmHubServer;
      if (existing && existing.exitCode === null) return; // Vite の再起動。起動済みの子プロセスをそのまま使う
      if (await isServerRunning()) {
        logger.info(`[pm-hub] 起動済みのサーバーを使用します (${HEALTH_URL})`);
        return;
      }

      // tsx CLI ではなく --import tsx で起動し、kill 対象を1プロセスにする
      const child = spawn(process.execPath, ["--import", "tsx", "server/src/index.ts"], {
        cwd: server.config.root,
        stdio: "inherit",
        env: { ...process.env, PMHUB_PARENT_PID: String(process.pid) },
      });
      globalState.__pmHubServer = child;

      child.on("exit", (code) => {
        if (code) logger.error(`[pm-hub] サーバーが終了しました (code ${code})`);
        if (globalState.__pmHubServer === child) globalState.__pmHubServer = undefined;
      });
      process.once("exit", () => {
        if (child.exitCode === null) child.kill();
      });
    },
  };
}
