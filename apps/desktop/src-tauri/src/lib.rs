// Tauri v2 expects a lib entrypoint even for desktop-only apps.
// For a pure desktop binary, this is a no-op that just re-exports
// `pub fn main()` from main.rs so `cargo tauri build` can link it.
#![cfg_attr(not(test), allow(dead_code))]
pub fn run() {
    println!("Paper OS Desktop — use the binary entrypoint in src/main.rs");
}
