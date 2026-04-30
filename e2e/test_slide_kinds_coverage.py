from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ALL_SLIDE_KINDS = [
    "cover",
    "bullets",
    "two-column",
    "table",
    "quote",
    "summary",
    "section",
    "stat",
    "image",
    "process",
    "cards",
    "compare",
    "layered",
    "progress",
    "chart",
    "mockup",
]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def extract_function_tail(source: str, name: str) -> str:
    marker = f"function {name}"
    start = source.index(marker)
    return source[start:]


def switch_cases(source: str) -> set[str]:
    return set(re.findall(r'case\s+"([^"]+)"\s*:', source))


def case_has_return(source: str, kind: str) -> bool:
    cases = list(re.finditer(r'case\s+"([^"]+)"\s*:', source))
    for idx, match in enumerate(cases):
        if match.group(1) != kind:
            continue
        scan = idx
        while scan < len(cases):
            body_start = cases[scan].end()
            body_end = cases[scan + 1].start() if scan + 1 < len(cases) else len(source)
            body = source[body_start:body_end]
            if "return (" in body or "return <" in body:
                return True
            if body.strip():
                return False
            scan += 1
    return False


def test_result_thumbnail_renderer_covers_all_slide_kinds() -> None:
    source = extract_function_tail(read("src/components/Result.tsx"), "renderThumbBody")
    cases = switch_cases(source)
    assert set(ALL_SLIDE_KINDS) <= cases, (
        f"Result.tsx renderThumbBody missing cases: "
        f"{set(ALL_SLIDE_KINDS) - cases}"
    )
    missing_returns = [kind for kind in ALL_SLIDE_KINDS if not case_has_return(source, kind)]
    assert missing_returns == [], (
        f"Result.tsx cases without a return body: {missing_returns}"
    )


def test_generator_render_slide_covers_all_slide_kinds() -> None:
    source = read("src/pptx/generator.ts")
    start = source.index("function renderSlide")
    end = source.index("// ---------------------------------------------------------------------", start)
    render_slide = source[start:end]
    cases = switch_cases(render_slide)
    assert set(ALL_SLIDE_KINDS) <= cases, (
        f"generator.ts renderSlide missing cases: "
        f"{set(ALL_SLIDE_KINDS) - cases}"
    )


def test_auto_illustrate_supports_expected_slide_kinds_with_mock_hook() -> None:
    source = read("src/providers/autoIllustrate.ts")
    for kind in ["cover", "bullets", "section", "summary"]:
        assert f'"{kind}"' in source, f"autoIllustrate.ts missing kind: {kind}"
    assert "imageGenerator?: ImageGenerator" in source
    assert "opts.imageGenerator ?? generateImage" in source
    assert "await imageGenerator(provider, prompt, opts.signal)" in source


def test_bullet_dominance_warning_is_available_and_surfaced() -> None:
    parser = read("src/md/parser.ts")
    main = read("src/components/Main.tsx")
    result = read("src/components/Result.tsx")
    assert "export function getSlideKindCounts" in parser
    assert "export function getBulletDominanceWarning" in parser
    assert "bullets / total <= 0.7" in parser
    assert "LLM がスライド型を多様化していません" in parser
    assert "getBulletDominanceWarning(finalDeck)" in main
    assert "getBulletDominanceWarning(next)" in result


def test_theme_directive_extractor_is_present_and_wired() -> None:
    parser = read("src/md/parser.ts")
    main = read("src/components/Main.tsx")
    assert "export function extractThemeDirective" in parser
    # Expect at least the four new themes referenced as targets
    for theme in ["warm", "cool", "forest", "playful"]:
        assert f'theme: "{theme}"' in parser, f"missing theme entry: {theme}"
    assert "extractThemeDirective(userInput)" in main


def test_themes_palette_includes_new_themes() -> None:
    themes = read("src/pptx/themes.ts")
    for theme in ["warm", "cool", "forest", "playful"]:
        assert f'{theme}: {{' in themes, f"themes.ts missing palette: {theme}"
    types = read("src/types.ts")
    assert '"warm"' in types and '"cool"' in types
    assert '"forest"' in types and '"playful"' in types


def test_minimal_pack_covers_all_slide_kinds() -> None:
    """Minimal pack must dispatch every SlideKind, otherwise switching
    the pack would silently drop slides on download."""
    source = extract_function_tail(
        read("src/pptx/packs/minimal.ts"), "renderMinimalSlide"
    )
    cases = switch_cases(source)
    assert set(ALL_SLIDE_KINDS) <= cases, (
        f"minimal.ts missing cases: {set(ALL_SLIDE_KINDS) - cases}"
    )


def test_pack_dispatch_wired_in_generator() -> None:
    """generator.ts must accept packId and dispatch to the minimal
    pack when requested. Catches a regression where the generator
    silently ignores the pack and always uses consulting."""
    gen = read("src/pptx/generator.ts")
    assert "packId: PackId" in gen
    assert 'packId === "minimal"' in gen
    assert "renderMinimalSlide" in gen


def test_pack_setting_wired_in_store_and_main() -> None:
    store = read("src/store/useAppStore.ts")
    main = read("src/components/Main.tsx")
    result = read("src/components/Result.tsx")
    assert "setPack: (p: PackId) => void" in store
    assert 'pack: "consulting"' in store
    assert "setPack(p.id)" in main
    assert "settings.pack" in result
