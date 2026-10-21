# PM Hub

AI にタスクを任せながら管理する、Windows 向けのデスクトップアプリです。
Tauri + React / TypeScript / Tailwind CSS v4 / Zustand で作られていて、手元で動く Node/Express + SQLite のサーバーが [Claude Code](https://claude.com/claude-code) CLI とつなぎます。

## 主な機能

- タスクの作成・編集・削除、ピン留め、カテゴリ、検索、並べ替え
- タスクごとの AI チャット（権限の確認、「常に許可」ルール、モデル選択）
- メモ、メッセージ、ブラウザのタブ（右パネル）
- インフォグラフィック（`Alt+I`）、ライト/ダーク/自動テーマ
- 引っ張って更新、スワイプ操作、トースト（元に戻す付き）、スケルトン表示
- 左右パネルの幅変更、キーボードショートカット（`?` で一覧）

## 必要なもの

| もの | 備考 |
| --- | --- |
| Windows 10/11 (x64) | |
| Node.js 24 | サーバーが `node:sqlite` を使います（動作確認は 24） |
| Rust と Visual Studio Build Tools (C++) | `tauri build` に必要です |
| Claude Code CLI | AI の実行に使います。ログイン済みであること |

## 開発

```bash
npm install

# ブラウザで開発（フロントエンド）
npm run dev          # http://localhost:1420

# サーバー（別のターミナルで）
npm run server       # http://127.0.0.1:3001 、Claude Code CLI につなぐ
npm run server:mock  # CLI を使わないモックモード
```

```bash
npm test             # ユニットテスト
npm run build        # 型チェック + フロントエンドのビルド
```

## インストーラを作る

別の PC でも、リポジトリを取得すれば同じ手順で作れます。

```bash
git clone https://github.com/taiyifuyuan2/pm-hub.git
cd pm-hub
npm install
npm run build:server   # サーバーを 1 ファイルにまとめ、同梱する Node 本体を用意する
npx tauri build        # インストーラを作る
```

`cargo` が見つからないと言われたら、`%USERPROFILE%\.cargo\bin` を PATH に追加してください。

できあがるインストーラ:

```
src-tauri/target/release/bundle/nsis/PM Hub_0.1.0_x64-setup.exe
```

PM Hub を終了してから、`/S` を付けて実行すると、サイレントで上書きインストールできます。

```powershell
& "src-tauri\target\release\bundle\nsis\PM Hub_0.1.0_x64-setup.exe" /S
```

`server-dist/` と `src-tauri/binaries/node-*.exe` は `npm run build:server` で作られる生成物なので、Git には入っていません。

## データの場所

| もの | 場所 |
| --- | --- |
| データベース | `%USERPROFILE%\.pm-hub\pm-hub.db` |
| ログ | `%USERPROFILE%\.pm-hub\server.log` |
| AI の作業フォルダ | `%USERPROFILE%\.pm-hub\workspaces` |

アプリを起動すると、サーバーも自動で立ち上がります（`127.0.0.1:3001`）。
更新の前にデータを残したいときは、`pm-hub.db`（同じ場所の `-wal`、`-shm` も）をコピーしてください。

## フォルダ構成

```
src/          フロントエンド（React）
server/       ローカルサーバー（Express + SQLite、Claude Code CLI との橋渡し）
shared/       フロントとサーバーで共有する型
src-tauri/    Tauri（Rust）の設定とアプリ本体
scripts/      ビルド用スクリプト
```
