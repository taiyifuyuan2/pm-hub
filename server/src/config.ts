import os from "node:os";
import path from "node:path";
import type { AgentMode } from "../../shared/agent";

const PERMISSION_MODES = ["default", "acceptEdits", "plan", "bypassPermissions"] as const;
type PermissionMode = (typeof PERMISSION_MODES)[number];

function parsePermissionMode(value: string | undefined): PermissionMode | undefined {
  if (!value) return undefined;
  if ((PERMISSION_MODES as readonly string[]).includes(value)) return value as PermissionMode;
  throw new Error(`PMHUB_PERMISSION_MODE は ${PERMISSION_MODES.join(" / ")} のいずれかを指定してください: ${value}`);
}

const dataDir = path.join(os.homedir(), ".pm-hub");

export const config = {
  port: Number(process.env.PMHUB_PORT ?? 3001),
  /** claude: Claude Code CLI を起動 / mock: ダミー応答をストリーミング */
  mode: (process.env.PMHUB_AGENT === "mock" || process.argv.includes("--mock") ? "mock" : "claude") as AgentMode,
  /** タスクごとの作業ディレクトリ（<root>/<taskId>）の親 */
  workspaceRoot: process.env.PMHUB_WORKSPACE ?? path.join(dataDir, "workspaces"),
  /** SQLite データベースファイル */
  dbPath: process.env.PMHUB_DB ?? path.join(dataDir, "pm-hub.db"),
  /** 起動元（Tauri / Vite）の PID。そのプロセスが消えたらサーバーも終了する */
  parentPid: process.env.PMHUB_PARENT_PID ? Number(process.env.PMHUB_PARENT_PID) : undefined,
  /** 未指定なら CLI の既定（-p モードでは許可が必要なツールは拒否される） */
  permissionMode: parsePermissionMode(process.env.PMHUB_PERMISSION_MODE),
  allowedOrigins: ["http://localhost:1420", "tauri://localhost", "http://tauri.localhost"],
};
