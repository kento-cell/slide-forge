"""End-to-end test for Cloud AI mode.

Drives the running vite dev server (http://localhost:1420) through:

  1. Pre-seed a cloud provider in localStorage.
  2. Generate a small deck through the real provider API.
  3. Download the generated .pptx.
  4. Validate the downloaded file is a real Office Open XML zip.

Required environment:

  SLIDE_FORGE_CLOUD_PROVIDER=gemini|groq|anthropic|openai

API key environment variables:

  gemini:    GEMINI_API_KEY or GOOGLE_API_KEY
  groq:      GROQ_API_KEY
  anthropic: ANTHROPIC_API_KEY or CLAUDE_API_KEY
  openai:    OPENAI_API_KEY

Optional:

  SLIDE_FORGE_CLOUD_MODEL=<provider model id>

Run with:

  cd E:/slide-forge
  py e2e/test_cloud_flow.py
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
import zipfile
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace"
    )
    sys.stderr = io.TextIOWrapper(
        sys.stderr.buffer, encoding="utf-8", errors="replace"
    )

from playwright.sync_api import sync_playwright

URL = "http://localhost:1420"
OUT = Path(__file__).parent / "downloads"
OUT.mkdir(parents=True, exist_ok=True)

DEFAULT_MODELS = {
    "gemini": "gemini-2.5-flash",
    "groq": "llama-3.3-70b-versatile",
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o-mini",
}

KEY_ENV = {
    "gemini": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    "groq": ("GROQ_API_KEY",),
    "anthropic": ("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"),
    "openai": ("OPENAI_API_KEY",),
}

PROMPT = """[プレゼン作成リクエスト]

■ タイトル: クラウドAI疎通確認
■ 目的: Slide Forge のクラウドAIモードでPPTX生成が完了するか確認する
■ 枚数: 4枚
■ 出力形式:
Markdownのみ。1行目は # タイトル。各スライドは ## 見出し。
箇条書き中心で短く具体的に。
"""


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def get_key(provider: str) -> str | None:
    for name in KEY_ENV[provider]:
        value = os.environ.get(name)
        if value:
            return value
    return None


def run() -> int:
    provider = os.environ.get("SLIDE_FORGE_CLOUD_PROVIDER", "gemini").lower()
    if provider not in DEFAULT_MODELS:
        log(f"✗ unsupported provider: {provider}")
        return 10

    api_key = get_key(provider)
    if not api_key:
        names = " or ".join(KEY_ENV[provider])
        log(f"SKIP: missing API key env for {provider}: {names}")
        return 10

    model = os.environ.get("SLIDE_FORGE_CLOUD_MODEL", DEFAULT_MODELS[provider])
    settings = {
        "provider": {"id": provider, "apiKey": api_key, "model": model},
        "theme": "navy",
        "setupDone": True,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()

        log(f"step 1: pre-seed cloud settings ({provider}, {model})")
        page.goto(URL, wait_until="domcontentloaded")
        page.evaluate(
            "settings => window.localStorage.setItem("
            "'slide-forge.settings.v1', JSON.stringify(settings))",
            settings,
        )
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function(
            "() => !document.body.innerText.includes('ローカル AI を検出中')",
            timeout=15_000,
        )

        body = page.inner_text("body")
        if "プロンプトを書いて" not in body:
            log("✗ did not reach Main")
            print(body[:500])
            return 2
        log("✓ on Main")

        log("step 2: fill small prompt")
        page.locator("textarea").fill(PROMPT)

        log("step 3: generate through cloud API")
        page.locator("button:has-text('生成')").first.click()
        page.wait_for_timeout(500)
        try:
            page.wait_for_function(
                "() => !!document.body.innerText.match(/枚 ·/) || "
                "!document.body.innerText.includes('生成中')",
                timeout=300_000,
            )
        except Exception:  # noqa: BLE001
            body = page.inner_text("body")
            log("✗ result page did not load")
            print(body[-1500:])
            return 3

        body_after_generate = page.inner_text("body")
        if not any(marker in body_after_generate for marker in ("枚 ·", "枚 ・")):
            log("✗ cloud generation returned to Main with an error")
            print(body_after_generate[-1500:])
            return 3

        title = page.inner_text("h1")
        meta = page.inner_text("h1 + p")
        log(f"   deck title: {title}")
        log(f"   meta: {meta}")

        log("step 4: PPTX download")
        with page.expect_download(timeout=60_000) as dl_info:
            page.locator("button:has-text('ダウンロード')").first.click()
        download = dl_info.value
        safe_provider = provider.replace("/", "_")
        save_path = OUT / f"cloud_{safe_provider}_{download.suggested_filename}"
        download.save_as(str(save_path))
        log(f"   saved -> {save_path} ({save_path.stat().st_size} bytes)")

        log("step 5: validate PPTX")
        if save_path.stat().st_size < 1000:
            log("✗ file too small")
            return 4
        with zipfile.ZipFile(save_path) as z:
            names = z.namelist()
            slides = [n for n in names if n.startswith("ppt/slides/slide")]
            missing = [
                required
                for required in ("[Content_Types].xml", "ppt/presentation.xml")
                if required not in names
            ]
            if missing:
                log(f"✗ missing required entries: {json.dumps(missing)}")
                return 5
            log(f"   ✓ valid OOXML zip, {len(slides)} slides, {len(names)} entries")

        log("=" * 50)
        log("CLOUD E2E PASS")
        log("=" * 50)
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
