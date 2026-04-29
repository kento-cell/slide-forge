//! OS-native API-key storage commands exposed to the React frontend.
//!
//! Each provider key is stored under the OS credential store using the
//! `keyring` crate, which routes to:
//!
//! * macOS    -> Keychain Services
//! * Windows  -> Credential Manager (DPAPI-encrypted)
//! * Linux    -> Secret Service (gnome-keyring / KWallet)
//!
//! Service name is `com.kentocell.slideforge` (matches tauri.conf.json
//! identifier) and the username is the provider id (`gemini`, `groq`,
//! `anthropic`, `openai`). One slot per provider; users can store keys
//! for multiple providers without collision.

use keyring::Entry;

const SERVICE: &str = "com.kentocell.slideforge";

fn entry(provider_id: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, provider_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_api_key(provider_id: String, key: String) -> Result<(), String> {
    let entry = entry(&provider_id)?;
    entry.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key(provider_id: String) -> Result<Option<String>, String> {
    let entry = entry(&provider_id)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_api_key(provider_id: String) -> Result<(), String> {
    let entry = entry(&provider_id)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        // Idempotent: deleting a missing key is a no-op success so the
        // UI's "clear saved key" button always succeeds without races.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
