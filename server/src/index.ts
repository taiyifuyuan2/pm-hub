import cors from "cors";
import express from "express";
import type { HealthResponse } from "../../shared/agent";
import { config } from "./config";
import { db } from "./db/database";
import { chatRouter } from "./routes/chat";
import { dataRouter } from "./routes/data";
import { googleRouter } from "./routes/google";
import { permissionsRouter } from "./routes/permissions";

const app = express();

// 許可したオリジン（Vite 開発サーバー / Tauri）以外のブラウザからは呼ばせない
app.use(cors({ origin: config.allowedOrigins }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    mode: config.mode,
    workspaceRoot: config.workspaceRoot,
    dbPath: config.dbPath,
  };
  res.json(body);
});

app.use("/api", dataRouter);
app.use("/api", chatRouter);
app.use("/api", googleRouter);
app.use("/api", permissionsRouter);

// 外部からアクセスされないよう 127.0.0.1 のみで待ち受ける
const server = app.listen(config.port, "127.0.0.1", () => {
  console.log(`[pm-hub server] http://127.0.0.1:${config.port}  mode=${config.mode}`);
  console.log(`[pm-hub server] db: ${config.dbPath}`);
  console.log(`[pm-hub server] workspaces: ${config.workspaceRoot}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error(
    err.code === "EADDRINUSE" ? `[pm-hub server] ポート ${config.port} は使用中です` : `[pm-hub server] ${err.message}`,
  );
  process.exit(1);
});

function shutdown() {
  server.close();
  db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// 起動元（Tauri / Vite）が kill されずに落ちた場合でも、孤児プロセスとして残らないようにする
if (config.parentPid) {
  const parentPid = config.parentPid;
  setInterval(() => {
    try {
      process.kill(parentPid, 0); // シグナル 0 は存在確認のみ
    } catch {
      console.log("[pm-hub server] parent process exited, shutting down");
      shutdown();
    }
  }, 2000).unref();
}
