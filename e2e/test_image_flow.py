"""End-to-end test for local image import.

Verifies that the Main drop/file area accepts image files, creates an
image slide, downloads a PPTX, and embeds the image under ppt/media.

Run with:
  cd E:/slide-forge
  py e2e/test_image_flow.py
"""
from __future__ import annotations

import binascii
import io
import struct
import sys
import time
import zipfile
import zlib
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


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    body = kind + payload
    return (
        struct.pack(">I", len(payload))
        + body
        + struct.pack(">I", binascii.crc32(body) & 0xFFFFFFFF)
    )


def write_sample_png(path: Path, width: int = 96, height: int = 64) -> None:
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            row.extend((30 + x % 180, 90 + y % 120, 190))
        rows.append(bytes(row))
    raw = b"".join(rows)
    data = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(raw))
        + png_chunk(b"IEND", b"")
    )
    path.write_bytes(data)


def run() -> int:
    sample = OUT / "sample_image_upload.png"
    svg = OUT / "unsafe_script.svg"
    write_sample_png(sample)
    svg.write_text(
        "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
        encoding="utf-8",
    )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()

        log("step 1: pre-seed offline settings")
        page.goto(URL, wait_until="domcontentloaded")
        page.evaluate(
            "window.localStorage.setItem('slide-forge.settings.v1', JSON.stringify("
            "{provider:{id:'offline'},theme:'navy',setupDone:true}"
            "))"
        )
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function(
            "() => document.body.innerText.includes('プロンプトを書いて')",
            timeout=15_000,
        )

        log("step 2: reject SVG input")
        page.locator("input[type=file]").set_input_files(str(svg))
        page.wait_for_function(
            "() => document.body.innerText.includes('対応ファイルは')",
            timeout=5_000,
        )

        log("step 3: upload image file")
        page.locator("input[type=file]").set_input_files(str(sample))

        log("step 4: wait for image result")
        page.wait_for_function(
            "() => !!document.body.innerText.match(/枚 ·/)",
            timeout=15_000,
        )
        title = page.inner_text("h1")
        meta = page.inner_text("h1 + p")
        log(f"   deck title: {title}")
        log(f"   meta: {meta}")
        if "sample image upload" not in title:
            log("✗ image filename was not used as deck title")
            return 2

        log("step 5: download PPTX")
        with page.expect_download(timeout=15_000) as dl_info:
            page.locator("button:has-text('ダウンロード')").first.click()
        download = dl_info.value
        save_path = OUT / f"image_{download.suggested_filename}"
        download.save_as(str(save_path))
        log(f"   saved -> {save_path} ({save_path.stat().st_size} bytes)")

        log("step 6: validate image embedded")
        with zipfile.ZipFile(save_path) as z:
            names = z.namelist()
            slides = [n for n in names if n.startswith("ppt/slides/slide")]
            media = [n for n in names if n.startswith("ppt/media/image")]
            if "[Content_Types].xml" not in names or "ppt/presentation.xml" not in names:
                log("✗ missing OOXML core files")
                return 3
            if len(slides) != 1:
                log(f"✗ expected 1 slide, got {len(slides)}")
                return 4
            if not media:
                log("✗ no embedded ppt/media/image* file found")
                return 5
            log(f"   ✓ valid OOXML zip, {len(slides)} slide, {len(media)} media image")

        log("=" * 50)
        log("IMAGE E2E PASS")
        log("=" * 50)
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
