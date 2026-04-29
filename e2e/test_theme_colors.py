"""Strict theme verification: each theme must produce a PPTX whose
slide XML carries that theme's primary color (and not other themes').

Generates 3 offline decks (one per theme), unzips each PPTX, scans
ppt/slides/*.xml for the theme-specific primary color hex, and fails
if any expected color is missing OR an unrelated theme's color leaks
in.

Run:
  cd E:/slide-forge
  E:/ai-article-auto-publisher/venv/Scripts/python.exe e2e/test_theme_colors.py
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

from playwright.sync_api import sync_playwright

URL = "http://localhost:1420"
OUT = Path(__file__).parent / "downloads"
OUT.mkdir(parents=True, exist_ok=True)

# Hex codes pulled from src/pptx/themes.ts. Each theme's primary
# color is a strong fingerprint — it shows up in the chrome accent
# bar, header title, table header, etc., on every non-cover slide.
THEMES = {
    "navy": {
        "primary": "1B3A6B",
        "primary_dark": "0B1F3F",
        "accent": "ED6C02",
        "bg_alt": "EAF1FA",
    },
    "light": {
        "primary": "0EA5E9",
        "primary_dark": "0369A1",
        "accent": "F59E0B",
        "bg_alt": "F5F7FA",
    },
    "mono": {
        "primary": "27272A",
        "primary_dark": "09090B",
        "accent": "FACC15",
        "bg_alt": "F4F4F5",
    },
}


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def slide_xml_dump(pptx: Path) -> str:
    out: list[str] = []
    with zipfile.ZipFile(pptx) as z:
        for name in z.namelist():
            if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                out.append(z.read(name).decode("utf-8", errors="replace"))
    return "\n".join(out)


def generate_for_theme(page, theme_id: str) -> Path:
    page.goto(URL, wait_until="domcontentloaded")
    page.evaluate(
        f"window.localStorage.setItem('slide-forge.settings.v1',"
        f"JSON.stringify({{provider:{{id:'offline'}},theme:'{theme_id}',"
        f"setupDone:true}}))"
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function(
        "() => document.body.innerText.includes('プロンプトを書いて')",
        timeout=15_000,
    )
    page.locator("button:has-text('▶ 生成')").first.click()
    page.wait_for_function(
        "() => !!document.body.innerText.match(/枚 ·/)",
        timeout=15_000,
    )
    with page.expect_download(timeout=30_000) as info:
        page.locator("button:has-text('ダウンロード')").first.click()
    dl = info.value
    target = OUT / f"theme_{theme_id}_{dl.suggested_filename}"
    dl.save_as(str(target))
    return target


def main() -> int:
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()
        for theme_id, expected in THEMES.items():
            log(f"=== theme: {theme_id} ===")
            try:
                pptx = generate_for_theme(page, theme_id)
            except Exception as e:  # noqa: BLE001
                failures.append(f"{theme_id}: generation/download failed: {e}")
                log(f"   ❌ generation failed: {e}")
                continue
            xml = slide_xml_dump(pptx)
            # Each color is uppercase hex without # in PptxGenJS output.
            primary = expected["primary"]
            other_primaries = [
                v["primary"] for k, v in THEMES.items() if k != theme_id
            ]
            primary_count = xml.upper().count(primary)
            leak_counts = {
                op: xml.upper().count(op) for op in other_primaries
            }
            log(f"   primary {primary} count: {primary_count}")
            for op, c in leak_counts.items():
                log(f"   leak {op} count: {c}")
            if primary_count < 5:
                failures.append(
                    f"{theme_id}: expected primary {primary} >=5 occurrences, "
                    f"got {primary_count}"
                )
                log(
                    f"   ❌ FAIL: primary color {primary} appears only "
                    f"{primary_count} times"
                )
                continue
            leaked = [op for op, c in leak_counts.items() if c > 0]
            if leaked:
                failures.append(
                    f"{theme_id}: foreign primary colors leaked into XML: {leaked}"
                )
                log(f"   ❌ FAIL: foreign primaries leaked: {leaked}")
                continue
            log(f"   ✅ PASS — {theme_id} primary present {primary_count}x, no leaks")
        browser.close()

    print("\n" + "=" * 60)
    if failures:
        print("THEME APPLICATION FAILURES:")
        for f in failures:
            print(f"  ❌ {f}")
        print("=" * 60)
        return 1
    print("ALL THEMES VERIFIED — primary colors propagate to PPTX XML")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
