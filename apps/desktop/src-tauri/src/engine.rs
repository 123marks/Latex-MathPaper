// Engine module: Tectonic downloader, probe, and compile wrapper.
// Exposed to the React frontend via Tauri commands (engine_status,
// engine_install_tectonic, engine_compile).

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;
use tauri::{Emitter, Window};

#[derive(serde::Serialize)]
pub struct EngineStatus {
    pub tectonic: EngineProbe,
    pub python: EngineProbe,
    pub latexmk: EngineProbe,
    pub platform: String,
    pub arch: String,
    pub download_url: String,
}

#[derive(serde::Serialize, Default, Clone)]
pub struct EngineProbe {
    pub present: bool,
    pub detail: String,
    pub path: Option<String>,
    pub source: String,
}

#[derive(serde::Serialize)]
pub struct CompileResult {
    pub engine: String,
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
    pub pdf: Option<Vec<u8>>,
}

fn engine_dir() -> PathBuf {
    let mut p = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push("paper-os");
    p.push("engine");
    fs::create_dir_all(&p).ok();
    p
}

fn engine_binary() -> PathBuf {
    let mut p = engine_dir();
    p.push(if cfg!(target_os = "windows") {
        "tectonic.exe"
    } else {
        "tectonic"
    });
    p
}

fn download_url() -> String {
    let base = "https://github.com/tectonic-typesetting/tectonic/releases/latest/download";
    let triple = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => "x86_64-pc-windows-msvc.zip",
        ("windows", "aarch64") => "aarch64-pc-windows-msvc.zip",
        ("macos", "x86_64") => "x86_64-apple-darwin.zip",
        ("macos", "aarch64") => "aarch64-apple-darwin.zip",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu.zip",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu.zip",
        _ => "x86_64-unknown-linux-gnu.zip",
    };
    format!("{}/tectonic-0.15.0-{}", base, triple)
}

fn probe(bin: &str) -> EngineProbe {
    let out = Command::new(bin).arg("--version").output();
    match out {
        Ok(o) if o.status.success() => {
            let v = String::from_utf8_lossy(&o.stdout);
            EngineProbe {
                present: true,
                detail: v.lines().next().unwrap_or("").to_string(),
                path: Some(bin.to_string()),
                source: "system".to_string(),
            }
        }
        _ => EngineProbe {
            present: false,
            detail: "not found".to_string(),
            path: None,
            source: "system".to_string(),
        },
    }
}

pub fn status() -> EngineStatus {
    let local = engine_binary();
    let tectonic = if local.exists() {
        let p = local.to_string_lossy().to_string();
        let mut probe = probe(&p);
        probe.source = "bundled".to_string();
        probe
    } else {
        probe("tectonic")
    };
    EngineStatus {
        tectonic,
        python: probe("python"),
        latexmk: probe("latexmk"),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        download_url: download_url(),
    }
}

pub fn install_tectonic(window: Window) -> Result<(), Box<dyn std::error::Error>> {
    let url = download_url();
    let _ = window.emit("tectonic://event", serde_json::json!({"event": "start", "url": url}));

    // Download the zip
    let resp = ureq::get(&url).call()?;
    let mut bytes = Vec::new();
    resp.into_reader().read_to_end(&mut bytes)?;
    let _ = window.emit(
        "tectonic://event",
        serde_json::json!({"event": "downloaded", "bytes": bytes.len()}),
    );

    let dir = engine_dir();
    let zip_path = dir.join("tectonic.zip");
    let mut f = File::create(&zip_path)?;
    f.write_all(&bytes)?;
    drop(f);

    // Extract
    let f = File::open(&zip_path)?;
    let mut archive = zip::ZipArchive::new(f)?;
    let mut found = None;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        if name.ends_with("tectonic") || name.ends_with("tectonic.exe") {
            let outpath = dir.join(if name.ends_with(".exe") { "tectonic.exe" } else { "tectonic" });
            let mut out = File::create(&outpath)?;
            std::io::copy(&mut entry, &mut out)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = out.metadata()?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&outpath, perms)?;
            }
            found = Some(outpath);
            break;
        }
    }
    fs::remove_file(&zip_path).ok();
    let _ = window.emit(
        "tectonic://event",
        serde_json::json!({"event": "done", "path": found.as_ref().map(|p| p.display().to_string())}),
    );
    Ok(())
}

pub fn compile(
    contest: String,
    path: String,
    _content: Option<String>,
) -> Result<CompileResult, Box<dyn std::error::Error>> {
    let local = engine_binary();
    let bin = if local.exists() {
        local.to_string_lossy().to_string()
    } else {
        which::which("tectonic")
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "tectonic".to_string())
    };

    let cwd = std::env::current_dir()?
        .join("contests")
        .join(&contest);
    let _ = std::fs::create_dir_all(cwd.join("build"));
    let output = Command::new(&bin)
        .arg(&path)
        .arg("--keep-intermediates")
        .arg("--outdir")
        .arg("build")
        .current_dir(&cwd)
        .output()?;

    let pdf_path = cwd.join("build").join(
        path.trim_end_matches(".tex").split('/').last().unwrap_or("main").to_string() + ".pdf",
    );
    let pdf = std::fs::read(&pdf_path).ok();

    Ok(CompileResult {
        engine: bin,
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        pdf,
    })
}
