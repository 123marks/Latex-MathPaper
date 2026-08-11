// Paper OS desktop entry. Spawns the embedded Node server (which exposes
// the same REST + SSE API the web app uses), then opens the native window
// pointed at that server. The Rust process also owns the Tectonic
// downloader (see engine.rs) — the React app calls it via Tauri's IPC.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

mod engine;

struct ServerHandle(Mutex<Option<Child>>);

#[tauri::command]
fn engine_status() -> engine::EngineStatus {
    engine::status()
}

#[tauri::command]
fn engine_install_tectonic(window: tauri::Window) -> Result<(), String> {
    engine::install_tectonic(window).map_err(|e| e.to_string())
}

#[tauri::command]
fn engine_compile(
    contest: String,
    path: String,
    content: Option<String>,
) -> Result<engine::CompileResult, String> {
    engine::compile(contest, path, content).map_err(|e| e.to_string())
}

fn main() {
    // Capture a paperos:// deep link from the OS (e.g. the OAuth callback
    // page re-opens the app). Tauri v2 forwards this via std::env::args().
    let deep_link = std::env::args()
        .find(|a| a.starts_with("paperos://"))
        .unwrap_or_default();

    tauri::Builder::default()
        .manage(ServerHandle(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            engine_status,
            engine_install_tectonic,
            engine_compile,
        ])
        .setup(move |app_handle| {
            // Spawn the Node backend; resolve server.mjs relative to the
            // Tauri Cargo project so dev (cargo tauri dev) and a bundled
            // build both find it.
            let server_mjs = if std::path::Path::new("../../app/server.mjs").exists() {
                "../../app/server.mjs"
            } else {
                "../../../app/server.mjs"
            };
            let port = pick_free_port();
            let server = Command::new("node")
                .arg(server_mjs)
                .env("PAPER_OS_PORT", port.to_string())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .expect("failed to spawn Node server");
            *app_handle.state::<ServerHandle>().0.lock().unwrap() = Some(server);

            // The desktop shell loads the bundled IDE at /ide/, NOT the
            // marketing homepage. If the user arrived via a paperos://
            // deep link (e.g. just finished OAuth in the system browser),
            // we hand the URL fragment to the webview so it can adopt
            // the new session. MUST use the Tauri API (window.navigate),
            // not JS (window.location.replace): Tauri 2's webview blocks
            // JS cross-origin navigation from the asset:// origin.
            let url = format!("http://127.0.0.1:{}/ide/", port);
            let nav = app_handle.app_handle().clone();
            tauri::async_runtime::spawn(async move {
                wait_for_health(&url).await;
                if let Some(window) = nav.get_webview_window("main") {
                    if let Ok(parsed) = url::Url::parse(&url) {
                        window.navigate(parsed).ok();
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Paper OS");
}

fn pick_free_port() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    port
}

async fn wait_for_health(base: &str) {
    for _ in 0..60 {
        if ureq::get(&format!("{}/api/health", base))
            .timeout(std::time::Duration::from_millis(500))
            .call()
            .is_ok()
        {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
}
