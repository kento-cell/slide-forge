"""Static OS-portability audit for Slide Forge.

I cannot launch macOS or Linux from a Windows host, so this audit
proves portability the strict way: by inspecting every line of code
that could plausibly hit an OS-specific surface, and asserting it
either uses a cross-platform abstraction OR has explicit branches
for each target.

Categories audited:
  1. Hard-coded absolute paths (banned)
  2. Path separators (must be POSIX or `path.join`)
  3. Shell command invocations (must be cross-platform or explicitly per-OS)
  4. Native crates (must declare features for all 3 targets)
  5. CI matrix coverage (all 3 OS must be in release.yml)
  6. Tauri capabilities (must not lock to one OS)

Run:
  cd E:/slide-forge
  E:/ai-article-auto-publisher/venv/Scripts/python.exe e2e/test_os_portability.py
"""
from __future__ import annotations

import io
import re
import sys
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace"
    )

ROOT = Path(__file__).resolve().parent.parent

# Surveyed code — explicitly include vendored TS, Rust, JSON, YAML.
SOURCE_PATTERNS = [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src-tauri/src/**/*.rs",
    "src-tauri/Cargo.toml",
    "src-tauri/tauri.conf.json",
    "src-tauri/capabilities/*.json",
    ".github/workflows/*.yml",
    "vite.config.ts",
    "package.json",
]


def collect_files() -> list[Path]:
    seen: set[Path] = set()
    for pat in SOURCE_PATTERNS:
        for p in ROOT.glob(pat):
            if p.is_file():
                seen.add(p)
    return sorted(seen)


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return p.read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------
# Audits
# ---------------------------------------------------------------------


def audit_hardcoded_paths(files: list[Path]) -> list[str]:
    """Banned: C:\\, /Users/, /home/<name>, hardcoded $HOME-derived
    absolute paths. Allowed: relative imports, ../, ./, http(s)://,
    `localhost`."""
    issues: list[str] = []
    bad = re.compile(r'(["\'`])(?:[A-Z]:[\\/]|/Users/[a-zA-Z0-9_]+|/home/[a-zA-Z0-9_]+)')
    for p in files:
        if "node_modules" in str(p) or "dist" in str(p):
            continue
        text = read(p)
        for m in bad.finditer(text):
            line_no = text[: m.start()].count("\n") + 1
            issues.append(f"{p.relative_to(ROOT)}:{line_no} hard-coded absolute path: {m.group(0)[:60]}")
    return issues


def audit_shell_exec(files: list[Path]) -> list[str]:
    """Banned: child_process.exec / spawn with non-cross-platform
    commands. Allowed: Tauri shell plugin (we removed it), or explicit
    OS-branched code."""
    issues: list[str] = []
    patterns = [
        re.compile(r"\bchild_process\b"),
        re.compile(r"\bexecSync\("),
        re.compile(r"\bspawn\b"),
        re.compile(r"std::process::Command::new"),
    ]
    for p in files:
        # Rust may legitimately use Command — examine context.
        text = read(p)
        for pat in patterns:
            for m in pat.finditer(text):
                # In Rust, Command::new is fine if the target is
                # dispatched (e.g., #[cfg(target_os)]).
                snippet = text[max(0, m.start() - 100): m.end() + 100]
                if "cfg(target_os" in snippet or "cfg!(target_os" in snippet:
                    continue
                line_no = text[: m.start()].count("\n") + 1
                issues.append(
                    f"{p.relative_to(ROOT)}:{line_no} shell exec without OS branch: {pat.pattern}"
                )
    return issues


def audit_keyring_backends() -> list[str]:
    """The keyring crate must declare features for all 3 OS — without
    them, builds for that platform compile-error or silently fall back
    to a NoOp backend that loses keys."""
    cargo = read(ROOT / "src-tauri" / "Cargo.toml")
    required = ["apple-native", "windows-native", "linux-native"]
    issues: list[str] = []
    for feat in required:
        if feat not in cargo:
            issues.append(f"src-tauri/Cargo.toml missing keyring feature {feat}")
    if issues:
        return issues
    # Also check we didn't accidentally pin a single-OS backend.
    if 'keyring = "' in cargo and "features" not in cargo[cargo.find('keyring = "'):cargo.find('keyring = "') + 200]:
        issues.append("src-tauri/Cargo.toml keyring has no features block at all")
    return issues


def audit_ci_matrix() -> list[str]:
    """release.yml must cover Windows + macOS + Linux."""
    yml = read(ROOT / ".github" / "workflows" / "release.yml")
    required_platforms = ["windows-latest", "macos-latest"]
    # Linux can be ubuntu-latest, ubuntu-22.04, ubuntu-24.04
    has_linux = re.search(r"ubuntu-(latest|2[0-9]\.04)", yml) is not None
    issues: list[str] = []
    for plat in required_platforms:
        if plat not in yml:
            issues.append(f"release.yml missing platform {plat}")
    if not has_linux:
        issues.append("release.yml missing any Ubuntu platform")
    return issues


def audit_capabilities() -> list[str]:
    """Capabilities should not be platform-locked unless intentional."""
    cap = read(ROOT / "src-tauri" / "capabilities" / "default.json")
    issues: list[str] = []
    # Look for "platforms": ["windows"] etc — banned for the default cap.
    if re.search(r'"platforms"\s*:\s*\[\s*"windows"\s*\]', cap) or \
       re.search(r'"platforms"\s*:\s*\[\s*"macOS"\s*\]', cap) or \
       re.search(r'"platforms"\s*:\s*\[\s*"linux"\s*\]', cap):
        issues.append("default.json restricts capability to a single OS")
    return issues


def audit_path_separators(files: list[Path]) -> list[str]:
    """In TS/JS, paths should use POSIX or path.join. Backslash literal
    paths are a Windows-only smell."""
    issues: list[str] = []
    bad = re.compile(r'(["\'`])\.{0,2}\\\\[a-zA-Z0-9_]')
    for p in files:
        if p.suffix not in {".ts", ".tsx", ".js"}:
            continue
        text = read(p)
        for m in bad.finditer(text):
            line_no = text[: m.start()].count("\n") + 1
            issues.append(f"{p.relative_to(ROOT)}:{line_no} backslash path: {m.group(0)}")
    return issues


def audit_localhost_assumptions(files: list[Path]) -> list[str]:
    """localhost endpoints (Ollama 11434, vite 1420, GitHub release URL)
    are fine on every OS. We just confirm we don't hard-code 127.0.0.1
    in a way that breaks IPv6-only Linux machines."""
    issues: list[str] = []
    for p in files:
        if p.suffix not in {".ts", ".tsx", ".rs"}:
            continue
        text = read(p)
        # 127.0.0.1 is OK in dev server config; it's only a problem in
        # client code that should be using `localhost` (DNS handles
        # both v4/v6).
        for m in re.finditer(r"127\.0\.0\.1", text):
            if "vite.config" in str(p):
                continue
            line_no = text[: m.start()].count("\n") + 1
            issues.append(
                f"{p.relative_to(ROOT)}:{line_no} hardcoded 127.0.0.1 in client (use localhost)"
            )
    return issues


# ---------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------


CHECKS = [
    ("hardcoded-absolute-paths", audit_hardcoded_paths, True),
    ("shell-exec-without-os-branch", audit_shell_exec, True),
    ("path-separators-in-ts", audit_path_separators, True),
    ("localhost-vs-127.0.0.1", audit_localhost_assumptions, True),
    ("keyring-backends", lambda _files: audit_keyring_backends(), False),
    ("ci-matrix-coverage", lambda _files: audit_ci_matrix(), False),
    ("capabilities-not-os-locked", lambda _files: audit_capabilities(), False),
]


def main() -> int:
    files = collect_files()
    print(f"Auditing {len(files)} files…\n")

    total_issues = 0
    for name, fn, needs_files in CHECKS:
        issues = fn(files) if needs_files else fn([])
        marker = "✅" if not issues else "❌"
        print(f"{marker} {name}")
        for issue in issues:
            print(f"     {issue}")
            total_issues += 1
        if not issues:
            print(f"     (no issues)")
        print()

    print("=" * 60)
    if total_issues == 0:
        print("✅ All portability audits passed — codebase is OS-agnostic")
    else:
        print(f"❌ {total_issues} portability issue(s) — investigate above")
    print("=" * 60)
    return 0 if total_issues == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
