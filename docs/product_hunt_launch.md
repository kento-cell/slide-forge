# Product Hunt Launch Kit — Slide Forge

This file collects every piece of copy, asset description, and
how-to needed to submit Slide Forge on Product Hunt. The submission
itself must be done by the maker on https://www.producthunt.com/
posts/new while signed in to a maker account — Product Hunt does not
accept programmatic submissions.

---

## 1. Submission form fields

### Tagline (60 chars max)
**Generate PowerPoint from a prompt — 100% local, $0 API.**

### Name
**Slide Forge**

### Topics / categories
- Productivity
- Artificial Intelligence
- Developer Tools
- Open Source

### Maker comment (1st pinned reply)

```
Hi PH 👋 I'm Kento, building Slide Forge.

I kept seeing the same friction every Friday afternoon: open
PowerPoint, stare at a blank slide, paste bullet points from notes,
spend 2 hours on layout. Existing AI presentation tools either lock
you into a subscription, send your slides to their cloud, or output
a deck you can't actually edit afterwards.

So I built a desktop app that:
* Runs 100% locally — your prompt and slides never leave your
  machine unless YOU choose a cloud LLM
* Uses YOUR own API key (Gemini / Groq / Anthropic / OpenAI) so
  there's no per-app subscription
* Or runs entirely offline via Ollama (no key, no network)
* Outputs a real `.pptx` file that opens in PowerPoint, Keynote,
  Google Slides, anywhere

11 visually-rich slide types — including big-number STAT slides,
chapter-divider SECTION slides, arrow-flow PROCESS slides, and
3-card grids — so the deck doesn't look like a wall of bullets.

It's MIT-licensed, the source is open, and there's zero telemetry.

Free for personal use. Cloud LLM costs are whatever your provider
charges (Gemini's free tier handles ~50 slides/day at $0).

Happy to answer anything!
```

### Long description (500-600 chars)

```
Slide Forge turns a prompt into a real PowerPoint file, locally.

* Bring your own API key — Gemini, Groq, Anthropic, OpenAI, or
  Ollama for fully offline. No per-app subscription, no shared key.
* Auto-detects local Ollama on launch — installed users go straight
  to generating, no setup.
* 11 slide types with rich shape decoration: cover, section divider,
  big-number stat, process flow, 3-card grid, comparison table,
  bullets, two-column, quote, summary, image.
* Per-slide auto-illustration — generate a content-aware image for
  each slide via your own Gemini/OpenAI key, embedded into the
  slide automatically.
* OS keychain stores API keys (Keychain / Credential Manager /
  Secret Service). Never written to localStorage or disk in plain.
* Ships for Windows / macOS / Linux. MIT licensed, zero telemetry,
  100% open source.
```

### Topics / first 3 hashtags
`#productivity #ai #opensource`

---

## 2. Visual assets needed (uploader prepares)

| Asset | Size | What to capture |
|---|---|---|
| Gallery image #1 | 1270×760 | Main screen with sample prompt + AI image-gen panel filled in |
| Gallery image #2 | 1270×760 | Result screen showing 11-type deck with shapes (use the all-types deck from `e2e/test_strict_quality.py` Q1) |
| Gallery image #3 | 1270×760 | A real slide from a downloaded PPTX (open in PowerPoint, screenshot full slide) — pick the SECTION or STAT slide for high impact |
| Gallery video (optional) | 60-90s | Wizard → mode select → prompt → generate → result → download |
| Logo | 240×240 | The 🎨 emoji on solid navy bg, white SLIDE FORGE wordmark below |

Recommended capture method:

```bash
# Run the desktop app
cd E:/slide-forge
$env:PATH = "C:/Users/kanaz/.cargo/bin;$env:PATH"
npm run tauri:dev
# Use Win+Shift+S to capture each screen, save as PNG
```

For the deck thumbnail screenshot, run the existing strict test
to produce a known-good 11-type PPTX:

```bash
E:/ai-article-auto-publisher/venv/Scripts/python.exe e2e/test_strict_quality.py
# downloads land in e2e/downloads/strict/q1_all_types_*.pptx
```

Open that PPTX in PowerPoint and screenshot whichever slide best
demonstrates visual richness.

---

## 3. Pre-launch checklist

Do **all** of these before clicking "Submit" on Product Hunt:

- [ ] **v0.2.0 (or later) is the latest GitHub Release** with all
      11 slide types + image gen + auto-illustration shipped.
      Procedure:
        1. Set GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY` and
           `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (empty) — see
           `docs/consultation_plan.md` §5.1.
        2. `git tag v0.2.0 -m "feat: rich shapes + image gen + ..."`
        3. `git push origin v0.2.0`
        4. Wait ~30 min for CI to publish Win/Mac/Linux installers
- [ ] **README has a clear screenshot or GIF** at the top — most
      PH visitors decide in 5 seconds based on the readme preview
- [ ] **5-min walk-through video** uploaded (optional but ~3x
      conversion). Loom or QuickTime is fine, no edits needed.
- [ ] **A real downloadable installer is on the latest release**.
      Click each link from a fresh browser to confirm.
- [ ] **MIT LICENSE file** is at repo root (already there)
- [ ] **README contains the install steps** in the first screen
- [ ] **No personal info** in the README or commit history
      (email leak, etc.) — `git log | grep -i email`
- [ ] **The Gemini free-tier setup link** in the wizard has been
      tested today — Google sometimes rotates the URL

---

## 4. Launch-day timing recommendations

* **Time:** Tuesday / Wednesday / Thursday at **00:01 PT** (UTC-8)
  = 17:01 JST. PH resets daily ranking at PT midnight; submitting
  at 00:01 maximizes visible time.
* **Duration:** Stay near the comments for the first 6 hours.
  Replies before voting peaks (PT 09:00 = JST 02:00) compound
  ranking signal.
* **Crosspost to Hacker News / Reddit `r/opensource` AT THE SAME
  TIME** (different audiences, same momentum). Hacker News title:
  "Slide Forge — local PowerPoint generator using your own LLM
  key (open source, no telemetry)".

---

## 5. Press-release-style PR draft

For potential blog crossposts (Zenn / Qiita / Hacker News
external links). Save as `docs/press_release.md` if you want to
publish separately.

```markdown
# Slide Forge — local-first AI presentation generator goes 1.0

Today we open-sourced Slide Forge, a desktop app that turns a
prompt into a real .pptx file using whichever LLM you already pay
for — or none at all.

## Why another presentation generator

Existing tools have one of three problems:
1. Subscription on top of the LLM you already pay for
2. Decks live in their cloud — can't edit in PowerPoint later
3. Output is so plain it just speeds up making boring slides

Slide Forge tackles all three:

| Problem | Slide Forge's answer |
|---|---|
| Double subscription | Bring your own API key. Or none — fully
  offline mode parses your Markdown to a deck without any LLM. |
| Vendor lock-in | Real .pptx output. Edit in PowerPoint, Keynote,
  LibreOffice, or upload to Google Slides. |
| Boring decks | 11 visually-rich slide types: chapter dividers
  with 220pt numerals, full-bleed STAT callouts, arrow-flow PROCESS
  pipelines, 3-card grids. Per-slide auto-illustration via your
  own Gemini/OpenAI key. |

## What it can use

| Provider | Free? | Notes |
|---|---|---|
| Google Gemini | Yes (free tier, ~50 slides/day at $0) | Best
  for solo users. Auto-detected. |
| Groq | Yes (free tier with limits) | Fastest output. |
| Anthropic Claude | Pay-per-use | Highest quality reasoning. |
| OpenAI GPT | Pay-per-use | Best for image generation
  (gpt-image-1, ~$0.04/slide image). |
| Ollama (local) | Yes (no network needed) | Auto-detected at
  http://localhost:11434. Pulls the model you've already installed. |
| None (offline) | Yes | Markdown → PPTX deterministic conversion. |

## Privacy and security posture

* API keys are stored in the OS-native credential store
  (Keychain on macOS, Credential Manager on Windows, Secret
  Service on Linux). Never written to disk in plain.
* CSP locks network calls to the four LLM endpoints + Ollama
  localhost + GitHub (for the auto-updater). No telemetry,
  no analytics.
* Auto-update is signed via minisign before delivery.
* `.pptx` output is fully embedded — generated images are inlined
  into the deck, no external CDN references.

## Get it

* Windows / macOS / Linux installers:
  https://github.com/kento-cell/slide-forge/releases
* Source: https://github.com/kento-cell/slide-forge
* MIT license. Issues and PRs welcome.
```

---

## 6. After launch

* Monitor Product Hunt comments hourly for the first 12 hours.
  Reply to every question.
* Track GitHub stars hourly — first 24 hours sets the social-proof
  baseline.
* Pin the GitHub README's badge row to include the PH ranking
  (use https://api.producthunt.com/widgets/embed-image/v1/featured.svg
  once the post is live).
* Open a `RELEASE_NOTES.md` and start logging post-launch issues
  there for transparency.

---

## 7. Things I cannot do for you

* Submit on your behalf — Product Hunt requires a real maker
  account with a verified email.
* Capture the screenshots — needs the desktop app running on a
  display, which I don't have.
* Record the demo video — same reason.

You'll need to follow §2 to capture visuals once a v0.2.0
installer is live.
