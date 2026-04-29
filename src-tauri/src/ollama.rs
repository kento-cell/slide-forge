//! Ollama bridge — runs HTTP calls in Rust so the webview never has
//! to make a cross-origin request to localhost:11434. Tauri 2's
//! webview origin (`http://tauri.localhost` on Windows,
//! `tauri://localhost` on mac/Linux) is rejected by Ollama's default
//! CORS allowlist, which causes every fetch from the JS side to throw
//! before it ever reaches the daemon. Routing through `#[tauri::command]`
//! sidesteps the browser's CORS gate entirely.

use futures_util::StreamExt;
use serde::Serialize;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const DEFAULT_ENDPOINT: &str = "http://localhost:11434";

fn endpoint_or_default(endpoint: Option<String>) -> String {
    endpoint
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_ENDPOINT.to_string())
}

#[derive(Serialize, Default)]
pub struct DetectResult {
    installed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    models: Vec<String>,
}

/// GET /api/version + /api/tags. Returns `installed: false` on any
/// failure so the wizard can render the "未インストール" branch
/// without surfacing a hard error.
#[tauri::command]
pub async fn ollama_detect(endpoint: Option<String>) -> DetectResult {
    let endpoint = endpoint_or_default(endpoint);
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
    {
        Ok(c) => c,
        Err(_) => return DetectResult::default(),
    };

    let version = match client.get(format!("{endpoint}/api/version")).send().await {
        Ok(r) if r.status().is_success() => r
            .json::<serde_json::Value>()
            .await
            .ok()
            .and_then(|v| v.get("version").and_then(|s| s.as_str()).map(str::to_string)),
        _ => return DetectResult::default(),
    };

    let models: Vec<String> = match client.get(format!("{endpoint}/api/tags")).send().await {
        Ok(r) if r.status().is_success() => r
            .json::<serde_json::Value>()
            .await
            .ok()
            .and_then(|v| v.get("models").cloned())
            .and_then(|m| m.as_array().cloned())
            .map(|arr| {
                arr.into_iter()
                    .filter_map(|m| m.get("name")?.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default(),
        _ => Vec::new(),
    };

    DetectResult {
        installed: true,
        version,
        models,
    }
}

/// POST /api/chat with stream=false. Returns the assistant's content
/// string, or an error string surfaced to JS as a rejected Promise.
#[tauri::command]
pub async fn ollama_chat(
    endpoint: Option<String>,
    model: String,
    system: String,
    user: String,
    temperature: Option<f32>,
) -> Result<String, String> {
    let endpoint = endpoint_or_default(endpoint);
    let client = reqwest::Client::builder()
        // Local LLMs can take minutes for a 14B model. Generous cap.
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "stream": false,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
        "options": { "temperature": temperature.unwrap_or(0.4) },
    });

    let res = client
        .post(format!("{endpoint}/api/chat"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama 接続失敗: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Ollama {status}: {text}"));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string())
}

#[derive(Serialize, Clone)]
pub struct PullProgress {
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    completed: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total: Option<u64>,
}

/// POST /api/pull with stream=true. Each NDJSON line becomes a
/// `ollama-pull-progress` Tauri event so the wizard can render a
/// progress bar without polling.
#[tauri::command]
pub async fn ollama_pull(
    app: AppHandle,
    endpoint: Option<String>,
    model: String,
) -> Result<(), String> {
    let endpoint = endpoint_or_default(endpoint);
    let client = reqwest::Client::builder()
        // No request timeout — pull can run for tens of minutes on
        // a slow link. The user can abort via the wizard UI.
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({ "name": model, "stream": true });
    let res = client
        .post(format!("{endpoint}/api/pull"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama pull 失敗: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Ollama pull 失敗: HTTP {}", res.status()));
    }

    let mut stream = res.bytes_stream();
    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buf.extend_from_slice(&chunk);
        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buf.drain(..=pos).collect();
            let line_str = String::from_utf8_lossy(&line[..line.len().saturating_sub(1)]);
            let trimmed = line_str.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(trimmed) {
                let progress = PullProgress {
                    status: obj
                        .get("status")
                        .and_then(|s| s.as_str())
                        .unwrap_or("")
                        .to_string(),
                    completed: obj.get("completed").and_then(|v| v.as_u64()),
                    total: obj.get("total").and_then(|v| v.as_u64()),
                };
                let _ = app.emit("ollama-pull-progress", &progress);
            }
        }
    }
    let _ = app.emit(
        "ollama-pull-progress",
        &PullProgress {
            status: "完了".to_string(),
            completed: None,
            total: None,
        },
    );
    Ok(())
}
