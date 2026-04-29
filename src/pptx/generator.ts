import PptxGenJS from "pptxgenjs";
import type { Deck, Slide, ThemeId } from "../types";
import { THEMES } from "./themes";

const W = 13.33;
const H = 7.5;

export async function generatePptx(deck: Deck, themeId: ThemeId): Promise<Blob> {
  const theme = THEMES[themeId];
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;
  pptx.author = "Slide Forge";

  const total = deck.slides.length;
  deck.slides.forEach((slide, i) => {
    const s = pptx.addSlide();
    s.background = { color: theme.colors.bg };
    renderSlide(s, slide, theme, i + 1, total);
  });

  const data = (await pptx.write({ outputType: "blob" })) as Blob;
  return data;
}

type Slide_ = NonNullable<ReturnType<PptxGenJS["addSlide"]>>;
type Theme = (typeof THEMES)[ThemeId];

function renderSlide(
  s: Slide_,
  slide: Slide,
  theme: Theme,
  page: number,
  total: number,
) {
  switch (slide.kind) {
    case "cover":
      return renderCover(s, slide, theme);
    case "bullets":
      return renderBullets(s, slide, theme, page, total);
    case "two-column":
      return renderTwoColumn(s, slide, theme, page, total);
    case "table":
      return renderTable(s, slide, theme, page, total);
    case "quote":
      return renderQuote(s, slide, theme, page, total);
    case "summary":
      return renderSummary(s, slide, theme, page, total);
    case "section":
      return renderSection(s, slide, theme, page, total);
    case "stat":
      return renderStat(s, slide, theme, page, total);
  }
}

// ---------------------------------------------------------------------
// Common chrome — applied to every non-cover, non-section slide so the
// deck has a consistent visual rhythm reminiscent of Miri Canvas /
// Canva business templates.
// ---------------------------------------------------------------------

function chromeAccent(s: Slide_, t: Theme) {
  // Vertical accent bar on the left edge — anchors the eye and
  // creates a clear "this is content" frame.
  s.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.18,
    h: H,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
  });
}

function chromeFooter(s: Slide_, page: number, total: number, t: Theme) {
  // Thin footer band with brand mark + page indicator.
  s.addShape("rect", {
    x: 0,
    y: H - 0.35,
    w: W,
    h: 0.35,
    fill: { color: t.colors.bgAlt },
    line: { color: t.colors.bgAlt, width: 0 },
  });
  s.addText("SLIDE FORGE", {
    x: 0.5,
    y: H - 0.32,
    w: 4,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 9,
    bold: true,
    color: t.colors.primary,
    valign: "middle",
    charSpacing: 4,
  });
  s.addText(`${page} / ${total}`, {
    x: W - 1.4,
    y: H - 0.32,
    w: 1.0,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 10,
    color: t.colors.textMuted,
    align: "right",
    valign: "middle",
  });
}

function chromeTitle(s: Slide_, title: string, t: Theme) {
  // Header bar — colored block behind the title for clear separation
  // from body content. Replaces the old simple "title + line" header.
  s.addShape("rect", {
    x: 0,
    y: 0.4,
    w: 0.6,
    h: 0.6,
    fill: { color: t.colors.accent },
    line: { color: t.colors.accent, width: 0 },
  });
  s.addText(title, {
    x: 0.8,
    y: 0.4,
    w: W - 1.3,
    h: 0.6,
    fontFace: t.fontHead,
    fontSize: 26,
    bold: true,
    color: t.colors.primary,
    valign: "middle",
  });
  s.addShape("line", {
    x: 0.5,
    y: 1.1,
    w: W - 1,
    h: 0,
    line: { color: t.colors.border, width: 1 },
  });
}

// ---------------------------------------------------------------------
// Cover — title slide. Geometry-heavy, dark background, big title.
// ---------------------------------------------------------------------

function renderCover(s: Slide_, slide: Extract<Slide, { kind: "cover" }>, t: Theme) {
  s.background = { color: t.colors.primaryDark };
  // Large geometric accents — corner ellipses + diagonal stripe.
  s.addShape("ellipse", {
    x: W - 3.0,
    y: -1.8,
    w: 5.5,
    h: 5.5,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
  });
  s.addShape("ellipse", {
    x: -1.8,
    y: H - 2.5,
    w: 4.5,
    h: 4.5,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
  });
  s.addShape("rect", {
    x: 0,
    y: H - 0.18,
    w: W,
    h: 0.18,
    fill: { color: t.colors.accent },
    line: { color: t.colors.accent, width: 0 },
  });
  // Small kicker label — sits above title for balance.
  s.addText("PRESENTATION", {
    x: 0.7,
    y: 1.7,
    w: W - 1.4,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 13,
    bold: true,
    color: t.colors.accent,
    charSpacing: 8,
  });
  s.addText(slide.title, {
    x: 0.7,
    y: 2.3,
    w: W - 1.4,
    h: 1.6,
    fontFace: t.fontHead,
    fontSize: 52,
    bold: true,
    color: "FFFFFF",
    valign: "top",
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.7,
      y: 4.2,
      w: W - 1.4,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 22,
      color: "EAF1FA",
    });
  }
  // Accent bar + tagline.
  s.addShape("rect", {
    x: 0.7,
    y: 5.4,
    w: 0.18,
    h: 1.2,
    fill: { color: t.colors.accent },
    line: { color: t.colors.accent, width: 0 },
  });
  if (slide.tagline) {
    s.addText(slide.tagline, {
      x: 1.05,
      y: 5.4,
      w: W - 2.1,
      h: 1.2,
      fontFace: t.fontHead,
      fontSize: 16,
      bold: true,
      color: "FFFFFF",
      valign: "top",
    });
  }
}

// ---------------------------------------------------------------------
// Bullets — numbered circles, accent bar, alternating row backgrounds.
// ---------------------------------------------------------------------

function renderBullets(
  s: Slide_,
  slide: Extract<Slide, { kind: "bullets" }>,
  t: Theme,
  page: number,
  total: number,
) {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);
  const items = slide.items.slice(0, 7);
  const startY = 1.5;
  const gap = 0.78;
  items.forEach((item, i) => {
    const y = startY + i * gap;
    // Subtle alternating row background — adds rhythm without
    // overwhelming the page.
    if (i % 2 === 0) {
      s.addShape("rect", {
        x: 0.4,
        y: y - 0.05,
        w: W - 0.8,
        h: gap - 0.1,
        fill: { color: t.colors.bgAlt },
        line: { color: t.colors.bgAlt, width: 0 },
      });
    }
    // Numbered circle marker (filled primary, white digit).
    s.addShape("ellipse", {
      x: 0.7,
      y: y + 0.05,
      w: 0.5,
      h: 0.5,
      fill: { color: t.colors.primary },
      line: { color: t.colors.primary, width: 0 },
    });
    s.addText(String(i + 1), {
      x: 0.7,
      y: y + 0.05,
      w: 0.5,
      h: 0.5,
      fontFace: t.fontHead,
      fontSize: 16,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    s.addText(item, {
      x: 1.4,
      y,
      w: W - 1.9,
      h: gap - 0.1,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.text,
      valign: "middle",
    });
  });
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Two-column — card-style with colored heading bands.
// ---------------------------------------------------------------------

function renderTwoColumn(
  s: Slide_,
  slide: Extract<Slide, { kind: "two-column" }>,
  t: Theme,
  page: number,
  total: number,
) {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);
  const half = (W - 1.5) / 2;
  ([
    { col: slide.left, x: 0.5, accent: t.colors.primary },
    { col: slide.right, x: 0.5 + half + 0.5, accent: t.colors.accent },
  ] as const).forEach(({ col, x, accent }) => {
    // Card body
    s.addShape("roundRect", {
      x,
      y: 1.4,
      w: half,
      h: 5.2,
      fill: { color: t.colors.bg },
      line: { color: t.colors.border, width: 1 },
      rectRadius: 0.12,
    });
    // Colored heading band on top of the card.
    s.addShape("roundRect", {
      x,
      y: 1.4,
      w: half,
      h: 0.8,
      fill: { color: accent },
      line: { color: accent, width: 0 },
      rectRadius: 0.12,
    });
    // Square the bottom of the heading band so it abuts the body.
    s.addShape("rect", {
      x,
      y: 2.0,
      w: half,
      h: 0.2,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    });
    if (col.heading) {
      s.addText(col.heading, {
        x: x + 0.25,
        y: 1.4,
        w: half - 0.5,
        h: 0.8,
        fontFace: t.fontHead,
        fontSize: 20,
        bold: true,
        color: "FFFFFF",
        valign: "middle",
      });
    }
    col.items.slice(0, 6).forEach((it, i) => {
      // Tiny dot marker, then text.
      s.addShape("ellipse", {
        x: x + 0.3,
        y: 2.6 + i * 0.6 + 0.18,
        w: 0.14,
        h: 0.14,
        fill: { color: accent },
        line: { color: accent, width: 0 },
      });
      s.addText(it, {
        x: x + 0.55,
        y: 2.5 + i * 0.6,
        w: half - 0.75,
        h: 0.5,
        fontFace: t.fontBody,
        fontSize: 14,
        color: t.colors.text,
        valign: "middle",
      });
    });
  });
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Table — banded rows, prominent header.
// ---------------------------------------------------------------------

function renderTable(
  s: Slide_,
  slide: Extract<Slide, { kind: "table" }>,
  t: Theme,
  page: number,
  total: number,
) {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);
  const headerRow = slide.headers.map((h) => ({
    text: h,
    options: {
      bold: true,
      color: "FFFFFF",
      fill: { color: t.colors.primary },
      align: "left" as const,
      valign: "middle" as const,
    },
  }));
  const bodyRows = slide.rows.slice(0, 8).map((r, ri) =>
    r.map((c) => ({
      text: c,
      options: {
        color: t.colors.text,
        // Banded rows for readability.
        fill: {
          color: ri % 2 === 0 ? t.colors.bg : t.colors.bgAlt,
        },
        valign: "middle" as const,
      },
    })),
  );
  s.addTable([headerRow, ...bodyRows], {
    x: 0.5,
    y: 1.4,
    w: W - 1,
    fontFace: t.fontBody,
    fontSize: 14,
    border: { type: "solid", pt: 0.5, color: t.colors.border },
    rowH: 0.55,
  });
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Quote — large decorative quotation marks, centered layout.
// ---------------------------------------------------------------------

function renderQuote(
  s: Slide_,
  slide: Extract<Slide, { kind: "quote" }>,
  t: Theme,
  page: number,
  total: number,
) {
  chromeAccent(s, t);
  if (slide.title) chromeTitle(s, slide.title, t);
  // Large opening quotation mark — decorative, in accent color.
  s.addText("“", {
    x: 1.0,
    y: 1.4,
    w: 1.5,
    h: 1.8,
    fontFace: t.fontHead,
    fontSize: 140,
    bold: true,
    color: t.colors.accent,
    valign: "top",
  });
  s.addText(slide.quote, {
    x: 2.5,
    y: 2.5,
    w: W - 3.5,
    h: 2.7,
    fontFace: t.fontHead,
    fontSize: 26,
    italic: true,
    color: t.colors.text,
    valign: "middle",
  });
  // Closing quote, smaller, bottom-right.
  s.addText("”", {
    x: W - 2.0,
    y: 4.5,
    w: 1.5,
    h: 1.8,
    fontFace: t.fontHead,
    fontSize: 100,
    bold: true,
    color: t.colors.accent,
    align: "right",
    valign: "top",
  });
  if (slide.cite) {
    s.addText(`— ${slide.cite}`, {
      x: 2.5,
      y: 5.6,
      w: W - 3.5,
      h: 0.4,
      fontFace: t.fontBody,
      fontSize: 14,
      color: t.colors.textMuted,
    });
  }
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Summary — checkmark items + branded footer band.
// ---------------------------------------------------------------------

function renderSummary(
  s: Slide_,
  slide: Extract<Slide, { kind: "summary" }>,
  t: Theme,
  page: number,
  total: number,
) {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);
  const items = slide.items.slice(0, 6);
  items.forEach((it, i) => {
    const y = 1.7 + i * 0.7;
    // Checkmark badge.
    s.addShape("rect", {
      x: 0.7,
      y: y + 0.1,
      w: 0.4,
      h: 0.4,
      fill: { color: t.colors.good },
      line: { color: t.colors.good, width: 0 },
      rectRadius: 0.05,
    });
    s.addText("✓", {
      x: 0.7,
      y: y + 0.1,
      w: 0.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 18,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    s.addText(it, {
      x: 1.3,
      y,
      w: W - 1.8,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.text,
      valign: "middle",
    });
  });
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Section divider — big chapter number, single visual focus.
// ---------------------------------------------------------------------

function renderSection(
  s: Slide_,
  slide: Extract<Slide, { kind: "section" }>,
  t: Theme,
  page: number,
  total: number,
) {
  s.background = { color: t.colors.primaryDark };
  // Right-side soft circle accent.
  s.addShape("ellipse", {
    x: W - 4.5,
    y: -1.5,
    w: 7,
    h: 7,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
  });
  s.addText("CHAPTER", {
    x: 0.7,
    y: 1.7,
    w: 6,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: t.colors.accent,
    charSpacing: 8,
  });
  // Huge chapter index.
  s.addText(slide.index, {
    x: 0.7,
    y: 2.2,
    w: 6,
    h: 3,
    fontFace: t.fontHead,
    fontSize: 220,
    bold: true,
    color: "FFFFFF",
    valign: "top",
  });
  // Accent rule under the digit.
  s.addShape("rect", {
    x: 0.7,
    y: 5.0,
    w: 1.4,
    h: 0.08,
    fill: { color: t.colors.accent },
    line: { color: t.colors.accent, width: 0 },
  });
  s.addText(slide.title, {
    x: 0.7,
    y: 5.3,
    w: W - 1.4,
    h: 0.9,
    fontFace: t.fontHead,
    fontSize: 32,
    bold: true,
    color: "FFFFFF",
    valign: "top",
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.7,
      y: 6.2,
      w: W - 1.4,
      h: 0.5,
      fontFace: t.fontBody,
      fontSize: 16,
      color: "EAF1FA",
    });
  }
  // Light footer page marker on dark bg.
  s.addText(`${page} / ${total}`, {
    x: W - 1.4,
    y: H - 0.45,
    w: 1.0,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 11,
    color: "EAF1FA",
    align: "right",
  });
}

// ---------------------------------------------------------------------
// Stat — single huge number, label, optional detail. KPI hero.
// ---------------------------------------------------------------------

function renderStat(
  s: Slide_,
  slide: Extract<Slide, { kind: "stat" }>,
  t: Theme,
  page: number,
  total: number,
) {
  chromeAccent(s, t);
  // No title chrome — the value IS the headline.
  // Background tint band behind the number.
  s.addShape("rect", {
    x: 0,
    y: 1.8,
    w: W,
    h: 3.5,
    fill: { color: t.colors.bgAlt },
    line: { color: t.colors.bgAlt, width: 0 },
  });
  // The big number.
  s.addText(slide.value, {
    x: 0.5,
    y: 1.8,
    w: W - 1,
    h: 3.5,
    fontFace: t.fontHead,
    fontSize: 180,
    bold: true,
    color: t.colors.primary,
    align: "center",
    valign: "middle",
  });
  // Label under the number.
  s.addText(slide.label, {
    x: 0.5,
    y: 5.4,
    w: W - 1,
    h: 0.6,
    fontFace: t.fontHead,
    fontSize: 26,
    bold: true,
    color: t.colors.text,
    align: "center",
    valign: "middle",
  });
  if (slide.detail) {
    s.addText(slide.detail, {
      x: 1.0,
      y: 6.0,
      w: W - 2,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 14,
      color: t.colors.textMuted,
      align: "center",
      valign: "middle",
    });
  }
  chromeFooter(s, page, total, t);
}
