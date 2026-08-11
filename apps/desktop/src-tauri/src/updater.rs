// Auto-updater scaffolding. On startup, check GitHub Releases for a newer
// version. If found, the Rust process downloads the patch, verifies the
// signature, and prompts the user to restart.
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize)]
struct Release {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    assets: Vec<Asset>,
}

#[derive(Serialize, Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
    size: u64,
}

pub fn check_for_update(repo: &str, current: &str) -> Option<Release> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
    let resp = ureq::get(&url)
        .timeout(Duration::from_secs(5))
        .call()
        .ok()?;
    let release: Release = resp.into_json().ok()?;
    if release.draft || release.prerelease {
        return None;
    }
    if release.tag_name.trim_start_matches('v') == current {
        return None;
    }
    Some(release)
}
