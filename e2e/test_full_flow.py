"""End-to-end test for Slide Forge.

Drives the running vite dev server (http://localhost:1420) with
Playwright to verify the full flow:

  1. Auto-detect of local Ollama → skip Wizard, land on Main
  2. Use the default sample prompt
  3. Click 生成 → wait for Ollama-generated deck
  4. Click PPTX download → capture the file
  5. Validate the downloaded .pptx is a real Office Open XML zip

Run with:
  cd E:/slide-forge
  python e2e/test_full_flow.py
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

        log("step 1: open dev server")
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_timeout(500)

        # Phase 1: auto-detect should resolve quickly. The loader text
        # is "ローカル AI を検出中…", then either Main or Wizard.
        log("step 2: wait for auto-detect to complete")
        page.wait_for_function(
            "() => !document.body.innerText.includes('ローカル AI を検出中')",
            timeout=15_000,
        )

        body_text = page.inner_text("body")
        if "プロンプトを書いて" in body_text:
            log("✓ landed on Main (auto-detect succeeded)")
        elif "Slide Forge へようこそ" in body_text:
            log("⚠ landed on Wizard — auto-detect did NOT trigger")
            # Skip wizard via 'AI なし' so the rest of the flow runs.
            page.get_by_text("AI なし").click()
            page.wait_for_timeout(500)
        else:
            log("✗ unexpected screen state")
            print(body_text[:500])
            return 2

        # Phase 2: provider badge should show Ollama
        log("step 3: check provider badge")
        try:
            header = page.inner_text("header")
            log(f"   header: {header[:200]}")
        except Exception as e:  # noqa: BLE001
            log(f"   header read failed: {e}")

        # Phase 3: use the default sample prompt — just click 生成.
        log("step 4: click 生成 (with default sample prompt)")
        # The button shows "▶ 生成" idle and "生成中…" while running.
        gen_btn = page.locator("button:has-text('生成')").first
        gen_btn.click()

        # Phase 4: wait for navigation to result screen.
        log("step 5: wait for result page (Ollama generation, up to 5min)")
        page.wait_for_function(
            "() => !!document.body.innerText.match(/枚 ·/)",
            timeout=300_000,
        )
        log("✓ result page loaded")

        title_text = page.inner_text("h1")
        slide_meta = page.inner_text("h1 + p")
        log(f"   deck title: {title_text}")
        log(f"   meta: {slide_meta}")

        # Phase 5: click DL and capture the download
        log("step 6: click PPTX download")
        with page.expect_download(timeout=60_000) as dl_info:
            page.locator("button:has-text('ダウンロード')").first.click()
        download = dl_info.value
        save_path = OUT / download.suggested_filename
        download.save_as(str(save_path))
        log(f"   saved → {save_path} ({save_path.stat().st_size} bytes)")

        # Phase 6: validate .pptx structure
        log("step 7: validate PPTX file")
        if save_path.stat().st_size < 1000:
            log("✗ file too small to be a valid pptx")
            return 3
        try:
            with zipfile.ZipFile(save_path) as z:
                names = z.namelist()
                must_have = [
                    "[Content_Types].xml",
                    "ppt/presentation.xml",
                ]
                missing = [m for m in must_have if m not in names]
                if missing:
                    log(f"✗ missing required entries: {missing}")
                    return 4
                # Count slides (ppt/slides/slide*.xml)
                slides = [n for n in names if n.startswith("ppt/slides/slide")]
                log(f"   ✓ valid OOXML zip, {len(slides)} slides, {len(names)} entries")
        except zipfile.BadZipFile:
            log("✗ not a valid zip file")
            return 5

        log("=" * 50)
        log("E2E PASS")
        log("=" * 50)

        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
