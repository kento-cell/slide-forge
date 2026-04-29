"""End-to-end test for the AI なし (offline) mode.

Drives the running vite dev server with Playwright through:

  1. Reset to the wizard (Ollama auto-detect would otherwise pick local).
  2. Choose ✏ AI なし → land on Main with the offline sample.
  3. Click 生成 (default sample is real Markdown, no LLM call).
  4. Capture the .pptx download and validate the OOXML structure.

Regression target: until 2026-04-29 the offline sample was the AI
task prompt (no real # / ## headers) and clicking 生成 raised
"スライドを抽出できませんでした".

Run with:
  cd E:/slide-forge
  python e2e/test_offline_flow.py
"""
from __future__ import annotations

import io
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


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def run() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()

        # Pre-seed localStorage with an offline-provider, setup-done
        # state so the auto-detect in App.tsx skips its probe and we
        # land directly on Main with provider=offline. This is what a
        # real user would have if they explicitly chose AI なし in the
        # wizard.
        log("step 1: pre-seed offline settings into localStorage")
        page.goto(URL, wait_until="domcontentloaded")
        page.evaluate(
            "window.localStorage.setItem('slide-forge.settings.v1', JSON.stringify("
            "{provider:{id:'offline'},theme:'navy',setupDone:true}"
            "))"
        )
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(500)

        log("step 2: confirm Main with offline mode")
        page.wait_for_function(
            "() => !document.body.innerText.includes('ローカル AI を検出中')",
            timeout=15_000,
        )

        body2 = page.inner_text("body")
        if "プロンプトを書いて" not in body2:
            log("✗ did not reach Main after wizard")
            return 2
        if "AI なしモード" not in body2:
            log("✗ Main is not showing offline-mode hint")
            return 3
        log("✓ on Main, offline mode active")

        log("step 4: click 生成 with the default offline sample")
        page.locator("button:has-text('生成')").first.click()

        log("step 5: wait for result page (offline = instant)")
        page.wait_for_function(
            "() => !!document.body.innerText.match(/枚 ·/)",
            timeout=15_000,
        )
        title = page.inner_text("h1")
        meta = page.inner_text("h1 + p")
        log(f"   deck title: {title}")
        log(f"   meta: {meta}")

        log("step 6: PPTX download")
        with page.expect_download(timeout=15_000) as dl_info:
            page.locator("button:has-text('ダウンロード')").first.click()
        download = dl_info.value
        save_path = OUT / f"offline_{download.suggested_filename}"
        download.save_as(str(save_path))
        log(f"   saved → {save_path} ({save_path.stat().st_size} bytes)")

        log("step 7: validate")
        if save_path.stat().st_size < 1000:
            log("✗ file too small")
            return 4
        with zipfile.ZipFile(save_path) as z:
            names = z.namelist()
            slides = [n for n in names if n.startswith("ppt/slides/slide")]
            if "[Content_Types].xml" not in names:
                log("✗ not a valid OOXML")
                return 5
            log(f"   ✓ valid OOXML zip, {len(slides)} slides, {len(names)} entries")

        log("=" * 50)
        log("OFFLINE E2E PASS")
        log("=" * 50)

        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
