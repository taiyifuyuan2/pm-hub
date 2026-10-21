use std::fs::{create_dir_all, File, OpenOptions};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent};

const SERVER_PORT: u16 = 3001;

/// Tauri が起動したローカルサーバーのプロセス（起動済みのものを使った場合は None）
struct ServerProcess(Mutex<Option<Child>>);

/// ポートで PM Hub サーバーが応答しているか（別アプリがポートを使っていても誤認しない）
fn is_server_running() -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], SERVER_PORT));
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(500)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
    let request = format!(
        "GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:{SERVER_PORT}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    response.starts_with("HTTP/1.1 200") && response.contains("\"ok\":true")
}

/// データ置き場（~/.pm-hub）。DB・作業フォルダ・サーバーログがここに入る
fn data_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(|home| PathBuf::from(home).join(".pm-hub"))
}

/// サーバーのログファイルを開く（追記）。リリース版はコンソールがないため、起動失敗の調査に使う
fn open_server_log() -> Option<File> {
    let dir = data_dir()?;
    create_dir_all(&dir).ok()?;
    OpenOptions::new().create(true).append(true).open(dir.join("server.log")).ok()
}

/// 開発時: ソースのある pm-hub/ を指して `node --import tsx` で起動する。
/// tsx CLI ではなく --import tsx にするのは、kill 対象を1プロセスにするため。
#[cfg(debug_assertions)]
fn server_command(_app: &tauri::AppHandle) -> Result<Command, String> {
    let dir = std::env::var_os("PMHUB_SERVER_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".."));
    let mut cmd = Command::new("node");
    cmd.args(["--import", "tsx", "server/src/index.ts"]).current_dir(dir);
    Ok(cmd)
}

/// 配布版: 同梱した Node（サイドカー）と、まとめたサーバー（リソース）で起動する。
/// Node は externalBin として本体の exe と同じフォルダに置かれる。
#[cfg(not(debug_assertions))]
fn server_command(app: &tauri::AppHandle) -> Result<Command, String> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(PathBuf::from))
        .ok_or("実行ファイルの場所を取得できませんでした")?;
    let node = exe_dir.join(if cfg!(windows) { "node.exe" } else { "node" });
    let script = app
        .path()
        .resource_dir()
        .map_err(|e| format!("リソースの場所を取得できませんでした: {e}"))?
        .join("server")
        .join("server.cjs");

    for (label, path) in [("Node", &node), ("サーバー", &script)] {
        if !path.exists() {
            return Err(format!("同梱の{label}が見つかりません: {}", path.display()));
        }
    }

    let mut cmd = Command::new(node);
    cmd.arg(&script);
    Ok(cmd)
}

fn spawn_server(app: &tauri::AppHandle) -> Result<Child, String> {
    let mut cmd = server_command(app)?;
    // Tauri が kill されずに落ちても、サーバーがこの PID の消滅を検知して自分で終了する
    cmd.env("PMHUB_PARENT_PID", std::process::id().to_string());

    if let Some(log) = open_server_log() {
        if let Ok(err) = log.try_clone() {
            cmd.stdout(Stdio::from(log)).stderr(Stdio::from(err));
        }
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn().map_err(|e| format!("サーバーを起動できませんでした: {e}"))
}

fn stop_server(app: &tauri::AppHandle) {
    let state = app.state::<ServerProcess>();
    let Ok(mut guard) = state.0.lock() else {
        return;
    };
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            // tauri dev では Vite プラグインが先に起動していることが多い。その場合はそれを使う
            if is_server_running() {
                println!("[pm-hub] 起動済みのサーバーを使用します");
            } else {
                match spawn_server(app.handle()) {
                    Ok(child) => {
                        println!("[pm-hub] サーバーを起動しました (pid {})", child.id());
                        *app.state::<ServerProcess>().0.lock().unwrap() = Some(child);
                    }
                    Err(err) => eprintln!("[pm-hub] {err}"),
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                stop_server(app);
            }
        });
}
