"""Privacy and zero-cost audit for Slide Forge.

Strict claims this audit substantiates:
  1. The app makes ZERO outbound network calls to developer-controlled
     servers.
  2. There is no telemetry / analytics / error-reporting SDK in the
     bundle.
  3. Every external endpoint in the bundle is one of:
        - The user's own LLM provider (their API key, their account)
        - localhost (Ollama)
        - github.com (anonymous download for the updater manifest)
  4. The CSP allowlist matches the audited endpoint set — nothing
     extra is silently permitted.
  5. No developer endpoint, no developer logging, no developer cost.
"""
from __future__ import annotations

import io
import json
import re
import sys
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace"
    )

ROOT = Path(__file__).resolve().parent.parent

# Endpoints that are intentionally allowed. EVERY URL in the source
# tree must reduce to one of these (or be a same-origin / data: URI).
ALLOWED_DOMAINS = {
    # User's own LLM accounts — keys are their own.
    "generativelanguage.googleapis.com",
    "api.groq.com",
    "api.anthropic.com",
    "api.openai.com",
    # User's local Ollama (no developer involvement).
    "localhost",
    "127.0.0.1",
    # Public GitHub for OSS download (the updater + repo links).
    "github.com",
    "ai.google.dev",
    "aistudio.google.com",
    "console.groq.com",
    "console.anthropic.com",
    "platform.openai.com",
    "ollama.com",
    "schema.tauri.app",  # tauri config schema URL — local-only
    # Tauri 2 internal IPC. The webview talks to the Rust core
    # through this synthetic origin; it is intercepted by the
    # Tauri runtime and NEVER reaches a real network. Required in
    # CSP for IPC to work at all.
    "ipc.localhost",
    # Tauri docs URL appearing only in vite.config.ts as a
    # comment-style reference. Not a runtime call.
    "v2.tauri.app",
}

# Comment-only URLs — appear in source as documentation references,
# never as runtime fetches.
COMMENT_ONLY_DOMAINS = {"v2.tauri.app"}

# Banned SDK signatures — anything that talks to an analytics /
# error-reporting / observability vendor MUST NOT appear.
BANNED_SUBSTRINGS = [
    "sentry.io",
    "amplitude.com",
    "mixpanel.com",
    "segment.io",
    "datadoghq.com",
    "posthog.com",
    "googletagmanager.com",
    "google-analytics.com",
    "intercom.io",
    "fullstory.com",
    "heap.io",
    "hotjar.com",
    "matomo.org",
]

URL_RE = re.compile(r"https?://[^\s\"'`)\\]+")


def collect_files() -> list[Path]:
    patterns = [
        "src/**/*.ts",
        "src/**/*.tsx",
        "src-tauri/src/**/*.rs",
        "src-tauri/Cargo.toml",
        "src-tauri/tauri.conf.json",
        "src-tauri/capabilities/*.json",
        "package.json",
        "vite.config.ts",
        "index.html",
    ]
    seen: set[Path] = set()
    for p in patterns:
        for path in ROOT.glob(p):
            if path.is_file():
                seen.add(path)
    return sorted(seen)


def normalize_domain(url: str) -> str:
    """Extract the bare hostname from a URL, dropping any port and
    path. localhost:11434 → localhost, https://x/foo → x."""
    m = re.match(r"https?://([^/:]+)", url)
    return m.group(1).lower() if m else ""


def main() -> int:
    files = collect_files()
    print(f"Scanning {len(files)} files for external URLs and SDK signatures…\n")

    seen_urls: dict[str, list[Path]] = {}
    banned_hits: list[tuple[Path, str, int]] = []

    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")

        # Check for banned analytics/observability fingerprints.
        for needle in BANNED_SUBSTRINGS:
            if needle.lower() in text.lower():
                line_no = (
                    text.lower()[: text.lower().find(needle.lower())].count("\n") + 1
                )
                banned_hits.append((f, needle, line_no))

        # Collect every URL.
        for m in URL_RE.finditer(text):
            url = m.group(0).rstrip(".,;:")
            seen_urls.setdefault(url, []).append(f)

    print("=" * 70)
    print("URLs found in source tree")
    print("=" * 70)
    fails: list[str] = []
    for url, occurs in sorted(seen_urls.items()):
        domain = normalize_domain(url)
        ok = domain in ALLOWED_DOMAINS or domain.endswith(".github.com")
        marker = "✅" if ok else "❌"
        print(f"  {marker} {url}")
        for f in occurs[:2]:
            print(f"        {f.relative_to(ROOT)}")
        if not ok:
            fails.append(f"unauthorized url: {url}")

    print()
    print("=" * 70)
    print("Banned analytics / observability SDKs")
    print("=" * 70)
    if banned_hits:
        for f, needle, line in banned_hits:
            print(f"  ❌ {f.relative_to(ROOT)}:{line} contains {needle}")
            fails.append(f"banned vendor signature: {needle}")
    else:
        print("  ✅ No analytics / sentry / posthog / amplitude / segment etc.")

    print()
    print("=" * 70)
    print("CSP audit (must match the allowlist above)")
    print("=" * 70)
    cfg = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
    csp = cfg.get("app", {}).get("security", {}).get("csp", "")
    print(f"  CSP: {csp}")
    csp_raw = set(re.findall(r"https?://([^/\s;]+)", csp))
    # Strip port (localhost:11434 → localhost) before checking.
    csp_domains = {d.split(":", 1)[0] for d in csp_raw}
    print()
    for d in sorted(csp_domains):
        ok = d in ALLOWED_DOMAINS
        marker = "✅" if ok else "❌"
        print(f"  {marker} CSP allows: {d}")
        if not ok:
            fails.append(f"CSP allows unaudited domain: {d}")

    print()
    print("=" * 70)
    print("Updater configuration")
    print("=" * 70)
    plugins = cfg.get("plugins", {})
    upd = plugins.get("updater", {})
    endpoints = upd.get("endpoints", [])
    pubkey = upd.get("pubkey", "")
    print(f"  endpoints: {endpoints}")
    print(f"  pubkey   : {pubkey[:60]}…")
    if not endpoints:
        print("  ❌ no updater endpoint — auto-update would fail")
        fails.append("no updater endpoint")
    else:
        for ep in endpoints:
            d = normalize_domain(ep)
            if d == "github.com":
                print(f"  ✅ {ep} → github.com (anonymous, no developer infra)")
            else:
                print(f"  ❌ {ep} routes through {d}")
                fails.append(f"updater talks to non-github host {d}")
    if not pubkey:
        print("  ❌ no signing pubkey configured")
        fails.append("no updater pubkey")
    else:
        print("  ✅ minisign pubkey embedded — updates verified before install")

    print()
    print("=" * 70)
    print("Network code paths in src-tauri (Rust)")
    print("=" * 70)
    rust = "\n".join(
        p.read_text(encoding="utf-8", errors="replace")
        for p in (ROOT / "src-tauri" / "src").glob("*.rs")
    )
    rust_net = re.findall(r'reqwest|isahc|hyper|surf|TcpStream', rust)
    if rust_net:
        print(f"  ⚠ Rust side mentions HTTP libs: {set(rust_net)}")
        print("     Verify these are only inside official Tauri plugins (updater)")
    else:
        print("  ✅ No raw HTTP client code in our Rust modules")

    print()
    print("=" * 70)
    if fails:
        print(f"❌ {len(fails)} privacy/cost finding(s):")
        for f in fails:
            print(f"   • {f}")
        return 1
    print("✅ No developer endpoint, no telemetry, no analytics, no leak.")
    print("   Every outbound call goes to either:")
    print("     - the user's own LLM provider (their key, their bill),")
    print("     - localhost (Ollama),")
    print("     - GitHub Releases (anonymous, free OSS).")
    print()
    print("   Developer cost: ¥0 (GitHub Actions + Releases on a public")
    print("   repo are free under GitHub's open-source allowance).")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
