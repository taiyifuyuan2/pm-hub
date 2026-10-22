use std::fs::{create_dir_all, File, OpenOptions};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::WebviewBuilder;
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, RunEvent, WebviewUrl, WindowEvent};

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

/// Windows の `\\?\` 拡張パス（verbatim）プレフィックスを取り除く。
/// resource_dir() 等が canonicalize 経由でこの形式を返すことがあり、
/// Node.js のメインモジュール解決がこのプレフィックスを扱えず
/// 'C:' だけを渡されたかのように誤動作するため、渡す前に普通のパスへ戻す。
#[cfg(windows)]
fn strip_verbatim_prefix(path: &PathBuf) -> PathBuf {
    match path.to_str() {
        Some(s) => match s.strip_prefix(r"\\?\") {
            Some(rest) => PathBuf::from(rest),
            None => path.clone(),
        },
        None => path.clone(),
    }
}

#[cfg(not(windows))]
fn strip_verbatim_prefix(path: &PathBuf) -> PathBuf {
    path.clone()
}

/// 配布版: 同梱した Node（サイドカー）と、まとめたサーバー（リソース）で起動する。
/// Node は externalBin として本体の exe と同じフォルダに置かれる。
#[cfg(not(debug_assertions))]
fn server_command(app: &tauri::AppHandle) -> Result<Command, String> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(PathBuf::from))
        .ok_or("実行ファイルの場所を取得できませんでした")?;
    let node = strip_verbatim_prefix(&exe_dir.join(if cfg!(windows) { "node.exe" } else { "node" }));
    let script = strip_verbatim_prefix(
        &app.path()
            .resource_dir()
            .map_err(|e| format!("リソースの場所を取得できませんでした: {e}"))?
            .join("server")
            .join("server.cjs"),
    );

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

/// 右パネルに重ねる子 WebView のラベル
const BROWSER_LABEL: &str = "browser";

#[derive(serde::Deserialize, Clone, Copy)]
struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn parse_url(url: &str) -> Result<tauri::Url, String> {
    let url: tauri::Url = url.parse().map_err(|e| format!("URL が正しくありません: {e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        other => Err(format!("{other}: は開けません（http / https のみ）")),
    }
}

fn browser_webview(app: &tauri::AppHandle) -> Result<tauri::Webview, String> {
    app.get_webview(BROWSER_LABEL).ok_or_else(|| "ブラウザがまだ開かれていません".to_string())
}

fn apply_bounds(webview: &tauri::Webview, b: Bounds) -> Result<(), String> {
    webview.set_position(LogicalPosition::new(b.x, b.y)).map_err(|e| e.to_string())?;
    webview.set_size(LogicalSize::new(b.width.max(1.0), b.height.max(1.0))).map_err(|e| e.to_string())
}

/// ブラウザ WebView を表示する（なければ作る）。url が None なら現在のページのまま
#[tauri::command]
async fn browser_show(app: tauri::AppHandle, url: Option<String>, bounds: Bounds) -> Result<(), String> {
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        apply_bounds(&webview, bounds)?;
        webview.show().map_err(|e| e.to_string())?;
        if let Some(url) = url {
            webview.navigate(parse_url(&url)?).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    let window = app.get_window("main").ok_or("メインウィンドウが見つかりません")?;
    let initial = match url {
        Some(u) => parse_url(&u)?,
        None => return Ok(()),
    };
    let emitter = app.clone();
    let builder = WebviewBuilder::new(BROWSER_LABEL, WebviewUrl::External(initial)).on_navigation(move |u| {
        let _ = emitter.emit("browser-url", u.to_string());
        matches!(u.scheme(), "http" | "https" | "about" | "blob" | "data")
    });
    window
        .add_child(builder, LogicalPosition::new(bounds.x, bounds.y), LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn browser_set_bounds(app: tauri::AppHandle, bounds: Bounds) -> Result<(), String> {
    match app.get_webview(BROWSER_LABEL) {
        Some(w) => apply_bounds(&w, bounds),
        None => Ok(()),
    }
}

/// タブを離れたときなど。ページは残したまま隠す
#[tauri::command]
fn browser_hide(app: tauri::AppHandle) -> Result<(), String> {
    match app.get_webview(BROWSER_LABEL) {
        Some(w) => w.hide().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

#[tauri::command]
fn browser_eval(app: tauri::AppHandle, action: String) -> Result<(), String> {
    let script = match action.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        "reload" => "location.reload()",
        _ => return Err("不明な操作です".into()),
    };
    browser_webview(&app)?.eval(script).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// 隠れているメインウィンドウを表示して、手前に出す
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// タスクトレイのアイコンとメニュー。ウィンドウを閉じても、ここから開き直せる
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "PM Hub を開く", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut builder = TrayIconBuilder::new()
        .tooltip("PM Hub（バックグラウンドで動いています）")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        // 2 つ目を起動しようとしたら、新しく起動せず、いま動いているウィンドウを出す
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main_window(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        // ウィンドウの × では終了せず、タスクトレイに隠れる（サーバーと自動の返信案づくりは動き続ける）
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            browser_show,
            browser_set_bounds,
            browser_hide,
            browser_eval
        ])
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            if let Err(err) = setup_tray(app) {
                eprintln!("[pm-hub] タスクトレイを作れませんでした: {err}");
            }
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
