"""Verify the default Cloud/Local prompt actually produces a deck
with SECTION + STAT + table + quote — not just bullets.

Hits Ollama (qwen2.5:14b) with the in-app default prompt and
inspects the generated Markdown for:

  * at least 1 SECTION divider (## SECTION ...)
  * at least 1 STAT slide   (## STAT ...)
  * at least 1 Markdown table (| ... |)
  * at least 1 blockquote slide body (> ...)
  * at least 1 plain bullets slide

If any are missing, the prompt didn't successfully steer the LLM
toward visual variety and needs more direct language.

Run:
  cd E:/slide-forge
  E:/ai-article-auto-publisher/venv/Scripts/python.exe e2e/test_prompt_variety.py
"""
from __future__ import annotations

import io
import re
import sys
import time

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace"
    )

from playwright.sync_api import sync_playwright

URL = "http://localhost:1420"


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()

        page.goto(URL, wait_until="domcontentloaded")
        page.evaluate(
            "window.localStorage.setItem('slide-forge.settings.v1',"
            "JSON.stringify({provider:{id:'ollama',model:'qwen2.5:14b'},"
            "theme:'navy',setupDone:true}))"
        )
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function(
            "() => document.body.innerText.includes('プロンプトを書いて')",
            timeout=15_000,
        )

        log("submitting in-app default prompt to Ollama")
        page.locator("button:has-text('▶ 生成')").first.click()
        page.wait_for_function(
            "() => !!document.body.innerText.match(/枚 ·/)",
            timeout=300_000,
        )
        title = page.inner_text("h1")
        meta = page.inner_text("h1 + p")
        log(f"   deck: '{title}' / {meta}")

        # Capture the raw markdown from the result page.
        page.locator("button:has-text('Markdown を見る')").click()
        md = page.inner_text("pre")
        browser.close()

    section_hits = len(re.findall(r"^##\s+SECTION\s+\d", md, re.MULTILINE))
    stat_hits = len(re.findall(r"^##\s+STAT\s+", md, re.MULTILINE))
    table_hits = len(re.findall(r"^\s*\|.*\|.*$", md, re.MULTILINE))
    # Detect blockquote body lines that are NOT cover meta lines
    # (cover メタは "> サブタイトル:" / "> タグライン:")
    blockquote_hits = len(
        [
            l for l in md.splitlines()
            if re.match(r"^\s*>\s+", l)
            and "サブタイトル" not in l
            and "タグライン" not in l
            and "副題" not in l
        ]
    )
    bullet_hits = len(re.findall(r"^\s*[-*]\s+\S", md, re.MULTILINE))

    print()
    print("=" * 60)
    print("PROMPT VARIETY AUDIT")
    print("=" * 60)
    checks = [
        ("SECTION divider slides", section_hits, 1),
        ("STAT highlight slides", stat_hits, 1),
        ("Markdown table rows", table_hits, 2),
        ("blockquote (non-cover) lines", blockquote_hits, 1),
        ("plain bullet lines", bullet_hits, 3),
    ]
    fails = 0
    for label, count, threshold in checks:
        ok = count >= threshold
        marker = "✅" if ok else "❌"
        print(f"{marker} {label}: {count} (>= {threshold})")
        if not ok:
            fails += 1
    print("=" * 60)
    if fails == 0:
        print("✅ Prompt successfully steered the LLM toward visual variety")
        return 0
    print(f"❌ {fails} check(s) failed — prompt needs to be more directive")
    print()
    print("--- generated markdown (truncated) ---")
    print(md[:1500])
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
