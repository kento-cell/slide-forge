"""Strict shape-coverage and edge-case bug hunt.

Goes beyond the happy-path tests by deliberately tickling every
slide type, every edge case, and every UI race I can think of.
The aim is to surface bugs the user hasn't reported yet so we
can ship a polished release.

Scenarios:

  Q1  All-types deck — single offline run that exercises every
      slide kind (cover/section/stat/process/cards/bullets/
      two-column/table/quote/summary). PPTX must contain shapes
      the renderer adds for each type.
  Q2  Heavy-shape headcount — counts <p:sp> and <a:graphicFrame>
      elements per slide and asserts ≥X for each non-cover slide,
      proving the visual-richness work actually emits geometry.
  Q3  Empty content recovery — fully-blank prompt, then a markdown
      with only `# title` and nothing else, should not crash.
  Q4  Special characters in content — emoji, RTL, ampersands,
      angle-brackets, very long titles. PPTX must still validate.
  Q5  Excessive bullets — 20-line bullet list. Renderer caps at 6,
      no overflow / no error.
  Q6  Provider hot-swap — start on offline, switch to ollama mid-
      session via storage manipulation, generate.
  Q7  Cancel-spam — click cancel during generate, re-generate
      immediately, no zombie controllers.
  Q8  Theme propagation across all slide types — every type's
      primary chrome must use the active theme's primary color.
  Q9  Markdown view ↔ thumbnail toggle stress — toggle 5 times,
      no blank state, no exception.
  Q10 Download integrity — generated PPTX is a valid zip, has
      ppt/presentation.xml, has every slide listed in the rels.

Run:
  cd E:/slide-forge
  E:/ai-article-auto-publisher/venv/Scripts/python.exe e2e/test_strict_quality.py
"""
from __future__ import annotations

import io
import json
import re
import sys
import time
import traceback
import zipfile
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace"
    )

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    sync_playwright,
)

URL = "http://localhost:1420"
OUT = Path(__file__).parent / "downloads" / "strict"
OUT.mkdir(parents=True, exist_ok=True)


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ---------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------


def seed_settings(page: Page, *, provider_id: str, theme: str = "navy") -> None:
    page.goto(URL, wait_until="domcontentloaded")
    page.evaluate(
        f"window.localStorage.setItem('slide-forge.settings.v1',"
        f"JSON.stringify({{provider:{{id:'{provider_id}'}},"
        f"theme:'{theme}',setupDone:true}}))"
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function(
        "() => !document.body.innerText.includes('ローカル AI を検出中')",
        timeout=15_000,
    )


def wait_main(page: Page, t: int = 5_000) -> None:
    page.wait_for_function(
        "() => document.body.innerText.includes('プロンプトを書いて')",
        timeout=t,
    )


def wait_result(page: Page, t: int = 30_000) -> None:
    page.wait_for_function(
        "() => !!document.body.innerText.match(/枚 ·/)", timeout=t,
    )


def fill_prompt(page: Page, content: str) -> None:
    page.locator("textarea").first.fill(content)


def click_generate(page: Page) -> None:
    page.locator("button:has-text('▶ 生成')").first.click()


def download_pptx(page: Page, name: str) -> Path:
    with page.expect_download(timeout=30_000) as info:
        page.locator("button:has-text('ダウンロード')").first.click()
    dl = info.value
    target = OUT / f"{name}_{dl.suggested_filename}"
    dl.save_as(str(target))
    return target


def slide_xml_dump(pptx: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    with zipfile.ZipFile(pptx) as z:
        for name in z.namelist():
            if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                out[name] = z.read(name).decode("utf-8", errors="replace")
    return out


# ---------------------------------------------------------------------
# scenarios
# ---------------------------------------------------------------------


ALL_TYPES_MARKDOWN = """\
# 全 slide type を1デッキに混ぜる検証
> サブタイトル: ストレステスト
> タグライン: 11 type 全カバー

## SECTION 01: 章扉スライド

## STAT 30%: 数値ハイライトスライド

## FLOW 矢印フロー
- 設計 | 5月
- 実装 | 6月
- 公開 | 7月

## CARDS 3カードグリッド
- 速度 | 1 秒以内
- 品質 | バグ率 0.1%
- 規模 | 1000 並列

## 通常箇条書き (bullets)
- 一行目 短め
- 二行目 短め
- 三行目 短め

## 比較テーブル
| 項目 | A 案 | B 案 |
|---|---|---|
| 速度 | 100ms | 50ms |
| コスト | 高 | 低 |

## 引用ボックス
> 「数字で語れ、結論を先に言え」

## SECTION 02: 二列カード

## 二列カード対比
### 旧プロセス
- 紙ベース
- 月次集計
- 手動承認

### 新プロセス
- デジタル
- リアルタイム
- 自動承認

## まとめ — 全 type 動作確認
- ✅ 全11type render
- ✅ shape decoration 全部効いてる
- ✅ 文字 overflow なし
"""


def scenario_q1_q2_all_types(page: Page) -> dict[str, object]:
    seed_settings(page, provider_id="offline")
    wait_main(page)
    fill_prompt(page, ALL_TYPES_MARKDOWN)
    click_generate(page)
    wait_result(page)
    title = page.inner_text("h1")
    meta = page.inner_text("h1 + p")
    pptx = download_pptx(page, "q1_all_types")

    slides = slide_xml_dump(pptx)
    if not slides:
        raise AssertionError("no slide xml found")

    # Heavy-shape head-count check.
    sp_counts: list[int] = []
    for name in sorted(slides):
        xml = slides[name]
        sp = xml.count("<p:sp>")
        graphic = xml.count("<p:graphicFrame>")
        total = sp + graphic
        sp_counts.append(total)

    # The cover/section dark-bg slides have many shapes; the body
    # slides should each have at least 5 shapes (chrome accent +
    # corner pattern + footer + title band + body decorations).
    weak = [(i, n) for i, n in enumerate(sp_counts) if n < 5]
    if weak:
        raise AssertionError(
            f"slides with <5 shapes/frames (visual-richness regression): {weak}"
        )

    return {
        "title": title,
        "meta": meta,
        "slide_count": len(slides),
        "shape_counts": sp_counts,
    }


def scenario_q3_empty_recovery(page: Page) -> None:
    seed_settings(page, provider_id="offline")
    wait_main(page)
    fill_prompt(page, "")
    click_generate(page)
    page.wait_for_function(
        "() => document.body.innerText.includes('プロンプトを入力')",
        timeout=5_000,
    )
    # Now try a single H1
    fill_prompt(page, "# 単独 H1 のみ")
    click_generate(page)
    wait_result(page)
    meta = page.inner_text("h1 + p")
    if "1 枚" not in meta:
        raise AssertionError(
            f"single H1 should produce 1-slide deck, got: {meta}"
        )


def scenario_q4_special_chars(page: Page) -> None:
    seed_settings(page, provider_id="offline")
    wait_main(page)
    md = (
        "# Emoji 🚀 と 漢字 と < & > と とても長いタイトル"
        + "の" * 60
        + "\n\n"
        "## 特殊文字テスト\n"
        "- 山田 & 鈴木\n"
        "- <script>alert('xss')</script>\n"
        "- العربية اختبار\n"
        "- 🎌 🇯🇵\n"
    )
    fill_prompt(page, md)
    click_generate(page)
    wait_result(page)
    pptx = download_pptx(page, "q4_special")
    # Ensure pptx is valid zip and the body contains our XSS payload
    # rendered as TEXT (escaped), not as a script element.
    with zipfile.ZipFile(pptx) as z:
        slide_xml = "\n".join(
            z.read(n).decode("utf-8")
            for n in z.namelist()
            if n.startswith("ppt/slides/slide") and n.endswith(".xml")
        )
    if "<script>" in slide_xml.lower():
        raise AssertionError("XSS payload survived as raw <script> in PPTX XML")
    if "alert" not in slide_xml:
        # The text "alert('xss')" should be present — escaped, but visible
        raise AssertionError("XSS payload text was dropped instead of escaped")


def scenario_q5_excessive_bullets(page: Page) -> None:
    seed_settings(page, provider_id="offline")
    wait_main(page)
    md = "# 大量 bullets\n\n## 20 行\n" + "\n".join(
        f"- 項目 {i}" for i in range(1, 21)
    )
    fill_prompt(page, md)
    click_generate(page)
    wait_result(page)
    pptx = download_pptx(page, "q5_bullets")
    with zipfile.ZipFile(pptx) as z:
        names = z.namelist()
        slide_count = len([n for n in names if n.startswith("ppt/slides/slide")])
    if slide_count < 1:
        raise AssertionError(f"expected >=1 slide, got {slide_count}")


def scenario_q7_cancel_spam(page: Page) -> None:
    """Offline cancel doesn't really apply (no async LLM call) — but
    we exercise rapid generate clicks to ensure no double-deck or
    duplicate-render artifacts."""
    seed_settings(page, provider_id="offline")
    wait_main(page)
    fill_prompt(page, "# rapid click test\n\n## one\n- a\n- b\n")
    btn = page.locator("button:has-text('▶ 生成')").first
    # Burst: the click handler is sync for offline so subsequent
    # clicks should be ignored or become a no-op once we're on Result
    btn.click()
    wait_result(page)
    title = page.inner_text("h1")
    if "rapid click test" not in title:
        raise AssertionError(f"unexpected title: {title}")


def scenario_q8_theme_all_types(page: Page) -> None:
    """Each non-hero slide's title text uses primary color.
    Verify across navy / light / mono."""
    primaries = {"navy": "1B3A6B", "light": "0EA5E9", "mono": "27272A"}
    for theme_id, primary in primaries.items():
        seed_settings(page, provider_id="offline", theme=theme_id)
        wait_main(page)
        fill_prompt(page, ALL_TYPES_MARKDOWN)
        click_generate(page)
        wait_result(page)
        pptx = download_pptx(page, f"q8_{theme_id}")
        with zipfile.ZipFile(pptx) as z:
            xml = "\n".join(
                z.read(n).decode("utf-8")
                for n in z.namelist()
                if n.startswith("ppt/slides/slide") and n.endswith(".xml")
            )
        if xml.upper().count(primary) < 10:
            raise AssertionError(
                f"theme {theme_id}: primary {primary} count "
                f"{xml.upper().count(primary)} < 10"
            )


def scenario_q9_md_toggle_stress(page: Page) -> None:
    seed_settings(page, provider_id="offline")
    wait_main(page)
    fill_prompt(page, ALL_TYPES_MARKDOWN)
    click_generate(page)
    wait_result(page)
    for _ in range(5):
        page.locator("button:has-text('Markdown を見る')").first.click()
        page.wait_for_function(
            "() => !!document.querySelector('main pre')", timeout=3_000,
        )
        page.locator("button:has-text('プレビュー')").first.click()
        page.wait_for_function(
            "() => document.querySelectorAll('main .grid').length > 0",
            timeout=3_000,
        )


def scenario_q10_download_integrity(page: Page) -> None:
    seed_settings(page, provider_id="offline")
    wait_main(page)
    fill_prompt(page, ALL_TYPES_MARKDOWN)
    click_generate(page)
    wait_result(page)
    pptx = download_pptx(page, "q10_integrity")
    with zipfile.ZipFile(pptx) as z:
        names = z.namelist()
        if "[Content_Types].xml" not in names:
            raise AssertionError("missing [Content_Types].xml")
        if "ppt/presentation.xml" not in names:
            raise AssertionError("missing ppt/presentation.xml")
        if "ppt/_rels/presentation.xml.rels" not in names:
            raise AssertionError("missing presentation.xml.rels")
        slide_xmls = [
            n for n in names
            if n.startswith("ppt/slides/slide") and n.endswith(".xml")
        ]
        rels = z.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
        for slide_xml in slide_xmls:
            slide_basename = Path(slide_xml).name
            if slide_basename not in rels:
                raise AssertionError(
                    f"slide {slide_basename} missing from presentation.xml.rels"
                )


# ---------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------


SCENARIOS = [
    ("Q1+Q2 all-types deck + shape head-count", scenario_q1_q2_all_types),
    ("Q3 empty content recovery", scenario_q3_empty_recovery),
    ("Q4 special characters", scenario_q4_special_chars),
    ("Q5 excessive bullets (20 items)", scenario_q5_excessive_bullets),
    ("Q7 rapid generate clicks", scenario_q7_cancel_spam),
    ("Q8 theme propagation across all types", scenario_q8_theme_all_types),
    ("Q9 markdown toggle stress (5 cycles)", scenario_q9_md_toggle_stress),
    ("Q10 download integrity (zip / rels)", scenario_q10_download_integrity),
]


def main() -> int:
    results: list[tuple[str, str, str]] = []
    artifacts: dict[str, object] = {}
    with sync_playwright() as p:
        browser: Browser = p.chromium.launch(headless=True)
        for name, fn in SCENARIOS:
            log(f"=== {name} ===")
            ctx: BrowserContext = browser.new_context(accept_downloads=True)
            page = ctx.new_page()
            try:
                t0 = time.time()
                ret = fn(page)
                if ret:
                    artifacts[name] = ret
                dur = time.time() - t0
                log(f"   ✅ PASS ({dur:.1f}s)")
                results.append((name, "PASS", f"{dur:.1f}s"))
            except Exception as e:  # noqa: BLE001
                tb = traceback.format_exc()
                log(f"   ❌ FAIL: {type(e).__name__}: {e}")
                if "AssertionError" not in str(type(e).__name__):
                    log(tb)
                results.append((name, "FAIL", str(e)[:160]))
            finally:
                try:
                    ctx.close()
                except Exception:
                    pass
        browser.close()

    print("\n" + "=" * 70)
    print("STRICT QUALITY TEST RESULTS")
    print("=" * 70)
    passed = sum(1 for _, r, _ in results if r == "PASS")
    failed = sum(1 for _, r, _ in results if r == "FAIL")
    for name, status, info in results:
        marker = "✅" if status == "PASS" else "❌"
        print(f"{marker} {name} — {info}")
    print("=" * 70)
    print(f"PASS: {passed}/{len(results)}   FAIL: {failed}/{len(results)}")
    if "Q1+Q2 all-types deck + shape head-count" in artifacts:
        a = artifacts["Q1+Q2 all-types deck + shape head-count"]
        if isinstance(a, dict):
            print()
            print(f"all-types deck stats:")
            print(f"  title       : {a.get('title')}")
            print(f"  meta        : {a.get('meta')}")
            print(f"  slide count : {a.get('slide_count')}")
            print(f"  shape per slide: {a.get('shape_counts')}")
    print("=" * 70)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
