// サーバー（server/src/index.ts）を依存ごと1ファイルにまとめ、Node 本体をサイドカーとして用意する。
//   server-dist/server.cjs                          … まとめたサーバー（Tauri のリソースとして同梱）
//   src-tauri/binaries/node-<target-triple>.exe     … 同梱する Node 本体（Tauri の externalBin）
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "server-dist", "server.cjs");

await build({
  entryPoints: [path.join(root, "server/src/index.ts")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  // 同梱する Node（process.version）に合わせる。node:sqlite は Node 組み込みなので外に出す
  target: `node${process.versions.node.split(".")[0]}`,
  format: "cjs",
  external: ["node:*"],
  legalComments: "none",
  logLevel: "info",
});

// Rust のターゲット（例: x86_64-pc-windows-msvc）。Tauri のサイドカーはこの接尾辞付きの名前で探される
const host = execFileSync("rustc", ["-vV"], { encoding: "utf8" }).match(/^host: (.+)$/m)?.[1];
if (!host) throw new Error("rustc のターゲットを取得できませんでした。Rust が入っているか確認してください。");

const binDir = path.join(root, "src-tauri", "binaries");
mkdirSync(binDir, { recursive: true });
const ext = process.platform === "win32" ? ".exe" : "";
const nodeDest = path.join(binDir, `node-${host}${ext}`);
// ビルドするたびに 90MB をコピーしないよう、同じサイズなら省略する
if (!existsSync(nodeDest) || statSync(nodeDest).size !== statSync(process.execPath).size) {
  copyFileSync(process.execPath, nodeDest);
}

const mb = (f) => (statSync(f).size / 1024 / 1024).toFixed(1);
console.log(`server.cjs ${mb(outFile)}MB / node sidecar ${mb(nodeDest)}MB (${process.version}, ${host})`);
