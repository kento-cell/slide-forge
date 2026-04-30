/** App version surfaced in the UI. Bump in lockstep with package.json,
 *  src-tauri/Cargo.toml, and src-tauri/tauri.conf.json on every release.
 *  Kept as a hand-edited constant rather than reading package.json so
 *  the bundle stays free of JSON imports / Vite config tweaks. */
export const APP_VERSION = "0.5.3";
