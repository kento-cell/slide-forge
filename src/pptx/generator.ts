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
    case "image":
      return renderImage(s, slide, theme, page, total);
    case "process":
      return renderProcess(s, slide, theme, page, total);
    case "cards":
      return renderCards(s, slide, theme, page, total);
    case "compare":
      return renderCompare(s, slide, theme, page, total);
    case "layered":
      return renderLayered(s, slide, theme, page, total);
    case "progress":
      return renderProgress(s, slide, theme, page, total);
    case "chart":
      return renderChart(s, slide, theme, page, total);
    case "mockup":
      return renderMockup(s, slide, theme, page, total);
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
  // Decorative corner pattern — three small squares stacked at the
  // top-right. Pure visual texture, no information content.
  for (let i = 0; i < 3; i++) {
    s.addShape("rect", {
      x: W - 0.55 - i * 0.2,
      y: 0.35,
      w: 0.13,
      h: 0.13,
      fill: { color: i === 0 ? t.colors.accent : t.colors.primary },
      line: { color: "FFFFFF", width: 0 },
    });
  }
  // Bottom-left subtle dot trio — mirrors the corner pattern.
  for (let i = 0; i < 3; i++) {
    s.addShape("ellipse", {
      x: 0.45 + i * 0.18,
      y: H - 0.85,
      w: 0.08,
      h: 0.08,
      fill: { color: t.colors.primary },
      line: { color: t.colors.primary, width: 0 },
    });
  }
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

// Bottom italic takeaway line — the "you can leave with this" anchor.
// Sits just above chromeFooter. Skipped silently if caption is empty.
function captionRow(s: Slide_, caption: string | undefined, t: Theme) {
  if (!caption || !caption.trim()) return;
  s.addText(caption.trim(), {
    x: 0.7,
    y: H - 0.78,
    w: W - 1.4,
    h: 0.4,
    fontFace: t.fontBody,
    fontSize: 12,
    italic: true,
    color: t.colors.textMuted,
    align: "center",
    valign: "middle",
    fit: "shrink",
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
  // Auto-illustration as full-bleed background with a dark overlay
  // for legibility. Drawn first so subsequent shapes / text sit on top.
  if (slide.image) {
    s.addImage({
      data: slide.image.dataUrl,
      x: 0,
      y: 0,
      w: W,
      h: H,
      sizing: { type: "cover", w: W, h: H },
    });
    // 65% dark overlay — title and subtitle stay readable on top of
    // any photo. Tunable: lower for brighter images.
    s.addShape("rect", {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: t.colors.primaryDark, transparency: 35 },
      line: { color: t.colors.primaryDark, width: 0 },
    });
  }
  // Large geometric accents — corner ellipses + diagonal stripe.
  s.addShape("ellipse", {
    x: W - 3.0,
    y: -1.8,
    w: 5.5,
    h: 5.5,
    fill: { color: t.colors.primary, transparency: slide.image ? 30 : 0 },
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
  const items = slide.items.slice(0, 6);
  const startY = 1.5;
  const gap = 0.92;
  // When auto-illustrated, split: text/badges occupy left ~58%,
  // image card occupies right ~38%. Without an image the row spans
  // full width as before.
  const hasImage = !!slide.image;
  const rowW = hasImage ? (W - 0.9) * 0.58 : W - 0.9;
  if (hasImage && slide.image) {
    const imgX = 0.5 + rowW + 0.4;
    const imgY = 1.4;
    const imgW = W - imgX - 0.5;
    const imgH = H - 1.85;
    s.addShape("roundRect", {
      x: imgX,
      y: imgY,
      w: imgW,
      h: imgH,
      fill: { color: t.colors.bgAlt },
      line: { color: t.colors.border, width: 1 },
      rectRadius: 0.12,
    });
    s.addImage({
      data: slide.image.dataUrl,
      x: imgX + 0.1,
      y: imgY + 0.1,
      w: imgW - 0.2,
      h: imgH - 0.2,
      sizing: { type: "cover", w: imgW - 0.2, h: imgH - 0.2 },
    });
  }
  // Bigger numbered badges with shadow for stronger visual presence.
  items.forEach((item, i) => {
    const y = startY + i * gap;
    // Pill-shaped row background (rounded). Replaces the flat
    // alternating stripe — every row gets it for consistency.
    s.addShape("roundRect", {
      x: 0.45,
      y: y - 0.05,
      w: rowW + 0.45,
      h: gap - 0.15,
      fill: { color: i % 2 === 0 ? t.colors.bgAlt : t.colors.bg },
      line: { color: t.colors.border, width: 0.75 },
      rectRadius: 0.1,
    });
    // Drop shadow under the numbered badge — second darker ellipse
    // offset by 0.04 inches gives a soft depth cue.
    s.addShape("ellipse", {
      x: 0.62,
      y: y + 0.07,
      w: 0.66,
      h: 0.66,
      fill: { color: t.colors.primaryDark },
      line: { color: t.colors.primaryDark, width: 0 },
    });
    // Main numbered badge.
    s.addShape("ellipse", {
      x: 0.6,
      y: y + 0.05,
      w: 0.66,
      h: 0.66,
      fill: { color: t.colors.primary },
      line: { color: "FFFFFF", width: 1.5 },
    });
    s.addText(String(i + 1).padStart(2, "0"), {
      x: 0.6,
      y: y + 0.05,
      w: 0.66,
      h: 0.66,
      fontFace: t.fontHead,
      fontSize: 18,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    // Side accent shape per item — rotates through diamond / triangle
    // / hexagon so the eye gets visual variety along the column.
    // When the row is narrowed for an image, the accent moves inside
    // the text column boundary to avoid overlap with the picture.
    const accentShapes = ["diamond", "triangle", "hexagon"] as const;
    const accentX = hasImage ? 0.5 + rowW : W - 0.85;
    s.addShape(accentShapes[i % accentShapes.length], {
      x: accentX,
      y: y + 0.18,
      w: 0.32,
      h: 0.32,
      fill: { color: t.colors.accent },
      line: { color: t.colors.accent, width: 0 },
    });
    s.addText(item, {
      x: 1.45,
      y,
      w: rowW - 1.0,
      h: gap - 0.1,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.text,
      valign: "middle",
    });
  });
  captionRow(s, slide.caption, t);
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
  captionRow(s, slide.caption, t);
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
  captionRow(s, slide.caption, t);
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
  captionRow(s, slide.caption, t);
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
  const hasImage = !!slide.image;
  const itemsW = hasImage ? (W - 0.9) * 0.6 : W - 1.4;
  if (hasImage && slide.image) {
    // Image card on right side, vertically aligned with summary list.
    const imgX = 0.5 + itemsW + 0.4;
    const imgY = 1.6;
    const imgW = W - imgX - 0.5;
    const imgH = H - 2.05;
    s.addShape("roundRect", {
      x: imgX,
      y: imgY,
      w: imgW,
      h: imgH,
      fill: { color: t.colors.bgAlt },
      line: { color: t.colors.border, width: 1 },
      rectRadius: 0.12,
    });
    s.addImage({
      data: slide.image.dataUrl,
      x: imgX + 0.1,
      y: imgY + 0.1,
      w: imgW - 0.2,
      h: imgH - 0.2,
      sizing: { type: "cover", w: imgW - 0.2, h: imgH - 0.2 },
    });
  }
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
      w: hasImage ? itemsW - 0.7 : W - 1.8,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.text,
      valign: "middle",
    });
  });
  captionRow(s, slide.caption, t);
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
  // Auto-illustration as background — placed first so the geometric
  // overlay sits on top with reduced opacity for atmosphere.
  if (slide.image) {
    s.addImage({
      data: slide.image.dataUrl,
      x: 0,
      y: 0,
      w: W,
      h: H,
      sizing: { type: "cover", w: W, h: H },
    });
    // Strong dark overlay so the chapter number stays the focal point.
    s.addShape("rect", {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: t.colors.primaryDark, transparency: 30 },
      line: { color: t.colors.primaryDark, width: 0 },
    });
  }
  // Layered geometric backdrop — large dim circle, medium primary
  // circle, small accent triangle. Creates depth without text noise.
  s.addShape("ellipse", {
    x: W - 6.0,
    y: -2.5,
    w: 9,
    h: 9,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
  });
  s.addShape("ellipse", {
    x: W - 4.5,
    y: -1.5,
    w: 6,
    h: 6,
    fill: { color: t.colors.primaryDark },
    line: { color: t.colors.primary, width: 2 },
  });
  // Diagonal accent stripe across the bottom-right corner.
  s.addShape("rect", {
    x: W - 3,
    y: H - 1.6,
    w: 4,
    h: 0.18,
    fill: { color: t.colors.accent },
    line: { color: t.colors.accent, width: 0 },
    rotate: -25,
  });
  // Tiny floating dots (visual texture).
  const dots: [number, number][] = [
    [9.5, 1.2], [10.2, 0.8], [11.0, 1.5], [11.5, 0.6], [10.6, 2.0],
  ];
  dots.forEach(([dx, dy]) => {
    s.addShape("ellipse", {
      x: dx,
      y: dy,
      w: 0.12,
      h: 0.12,
      fill: { color: t.colors.accent },
      line: { color: t.colors.accent, width: 0 },
    });
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
  // Concentric ring decoration centered behind the number — three
  // outline-only ellipses radiating outward, decreasing opacity via
  // border thickness. Frames the headline value.
  const cx = W / 2;
  const cy = 3.55;
  for (let i = 0; i < 3; i++) {
    const r = 1.4 + i * 0.5;
    s.addShape("ellipse", {
      x: cx - r,
      y: cy - r,
      w: r * 2,
      h: r * 2,
      fill: { type: "none" },
      line: { color: t.colors.primary, width: 1 - i * 0.25, dashType: "dash" },
    });
  }
  // Small accent dots at each ring's compass points (decoration).
  const dotPositions: [number, number][] = [
    [cx, cy - 1.9], [cx + 1.9, cy], [cx, cy + 1.9], [cx - 1.9, cy],
  ];
  dotPositions.forEach(([dx, dy]) => {
    s.addShape("ellipse", {
      x: dx - 0.08,
      y: dy - 0.08,
      w: 0.16,
      h: 0.16,
      fill: { color: t.colors.accent },
      line: { color: t.colors.accent, width: 0 },
    });
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

// ---------------------------------------------------------------------
// Image — local user image, normalized by the browser before it reaches
// this renderer. No external URLs are embedded in the PPTX.
// ---------------------------------------------------------------------

function renderImage(
  s: Slide_,
  slide: Extract<Slide, { kind: "image" }>,
  t: Theme,
  page: number,
  total: number,
) {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);

  const box = { x: 0.75, y: 1.45, w: W - 1.5, h: 4.95 };
  s.addShape("roundRect", {
    ...box,
    fill: { color: t.colors.bgAlt },
    line: { color: t.colors.border, width: 1 },
    rectRadius: 0.12,
  });

  const placed = fitInside(slide.width, slide.height, box);
  s.addImage({
    data: slide.dataUrl,
    x: placed.x,
    y: placed.y,
    w: placed.w,
    h: placed.h,
  });

  if (slide.caption) {
    s.addText(slide.caption, {
      x: 0.8,
      y: 6.52,
      w: W - 1.6,
      h: 0.32,
      fontFace: t.fontBody,
      fontSize: 10,
      color: t.colors.textMuted,
      align: "center",
      valign: "middle",
      fit: "shrink",
    });
  }
  chromeFooter(s, page, total, t);
}

function fitInside(
  imageW: number,
  imageH: number,
  box: { x: number; y: number; w: number; h: number },
) {
  const scale = Math.min(box.w / imageW, box.h / imageH);
  const w = imageW * scale;
  const h = imageH * scale;
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
  };
}

// ---------------------------------------------------------------------
// Process — N steps as connected boxes with arrows between them.
// ---------------------------------------------------------------------

function renderProcess(
  s: Slide_,
  slide: Extract<Slide, { kind: "process" }>,
  t: Theme,
  page: number,
  total: number,
): void {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);
  const steps = slide.steps.slice(0, 5);
  const n = steps.length;
  const margin = 0.5;
  const arrowGap = 0.3;
  const totalArrowsWidth = (n - 1) * arrowGap;
  const boxW = (W - margin * 2 - totalArrowsWidth) / n;
  const boxH = 3.0;
  const startY = 2.2;

  steps.forEach((step, i) => {
    const x = margin + i * (boxW + arrowGap);
    // Step card
    s.addShape("roundRect", {
      x,
      y: startY,
      w: boxW,
      h: boxH,
      fill: { color: t.colors.bg },
      line: { color: t.colors.primary, width: 1.5 },
      rectRadius: 0.15,
    });
    // Numbered badge at top of card
    s.addShape("ellipse", {
      x: x + boxW / 2 - 0.35,
      y: startY - 0.35,
      w: 0.7,
      h: 0.7,
      fill: { color: t.colors.primary },
      line: { color: "FFFFFF", width: 2 },
    });
    s.addText(String(i + 1).padStart(2, "0"), {
      x: x + boxW / 2 - 0.35,
      y: startY - 0.35,
      w: 0.7,
      h: 0.7,
      fontFace: t.fontHead,
      fontSize: 18,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    // Step label
    s.addText(step.label, {
      x: x + 0.15,
      y: startY + 0.6,
      w: boxW - 0.3,
      h: 0.9,
      fontFace: t.fontHead,
      fontSize: 16,
      bold: true,
      color: t.colors.primary,
      align: "center",
      valign: "middle",
    });
    if (step.detail) {
      s.addText(step.detail, {
        x: x + 0.15,
        y: startY + 1.55,
        w: boxW - 0.3,
        h: boxH - 1.7,
        fontFace: t.fontBody,
        fontSize: 12,
        color: t.colors.textMuted,
        align: "center",
        valign: "top",
      });
    }
    // Arrow to next step (right-pointing chevron)
    if (i < n - 1) {
      const ax = x + boxW + 0.02;
      const ay = startY + boxH / 2 - 0.2;
      s.addShape("rightArrow", {
        x: ax,
        y: ay,
        w: arrowGap - 0.04,
        h: 0.4,
        fill: { color: t.colors.accent },
        line: { color: t.colors.accent, width: 0 },
      });
    }
  });

  captionRow(s, slide.caption, t);
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Cards — 3 colored cards in a row with heading + body text.
// ---------------------------------------------------------------------

function renderCards(
  s: Slide_,
  slide: Extract<Slide, { kind: "cards" }>,
  t: Theme,
  page: number,
  total: number,
) {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);
  const cards = slide.cards.slice(0, 3);
  const n = cards.length;
  const margin = 0.6;
  const cardGap = 0.35;
  const cardW = (W - margin * 2 - cardGap * (n - 1)) / n;
  const cardH = 4.5;
  const startY = 1.8;

  // Color palette across cards: primary / accent / good (varied).
  const palette = [t.colors.primary, t.colors.accent, t.colors.good];

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + cardGap);
    const accent = palette[i % palette.length];
    // Card body (white with border)
    s.addShape("roundRect", {
      x,
      y: startY,
      w: cardW,
      h: cardH,
      fill: { color: t.colors.bg },
      line: { color: t.colors.border, width: 1 },
      rectRadius: 0.18,
    });
    // Top color band on the card
    s.addShape("roundRect", {
      x,
      y: startY,
      w: cardW,
      h: 1.0,
      fill: { color: accent },
      line: { color: accent, width: 0 },
      rectRadius: 0.18,
    });
    // Square the bottom of the band so it abuts the body
    s.addShape("rect", {
      x,
      y: startY + 0.8,
      w: cardW,
      h: 0.2,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    });
    // Decorative diamond shape in the band
    s.addShape("diamond", {
      x: x + cardW - 0.55,
      y: startY + 0.18,
      w: 0.4,
      h: 0.6,
      fill: { color: "FFFFFF" },
      line: { color: "FFFFFF", width: 0 },
    });
    // Card index number on the band
    s.addText(String(i + 1).padStart(2, "0"), {
      x: x + 0.25,
      y: startY,
      w: 1.5,
      h: 1.0,
      fontFace: t.fontHead,
      fontSize: 32,
      bold: true,
      color: "FFFFFF",
      valign: "middle",
    });
    // Heading
    s.addText(card.heading, {
      x: x + 0.3,
      y: startY + 1.2,
      w: cardW - 0.6,
      h: 0.9,
      fontFace: t.fontHead,
      fontSize: 18,
      bold: true,
      color: t.colors.primary,
      valign: "top",
    });
    // Divider line under heading
    s.addShape("line", {
      x: x + 0.3,
      y: startY + 2.05,
      w: 0.8,
      h: 0,
      line: { color: accent, width: 2 },
    });
    // Body text
    s.addText(card.body, {
      x: x + 0.3,
      y: startY + 2.2,
      w: cardW - 0.6,
      h: cardH - 2.5,
      fontFace: t.fontBody,
      fontSize: 13,
      color: t.colors.text,
      valign: "top",
    });
  });

  captionRow(s, slide.caption, t);
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Compare — Before → arrow → After. Two cards with center arrow.
// Tone "bad" colors the left card red-tinted; "good" colors right green.
// ---------------------------------------------------------------------

function renderCompare(
  s: Slide_,
  slide: Extract<Slide, { kind: "compare" }>,
  t: Theme,
  page: number,
  total: number,
): void {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);

  const cardW = 5.5;
  const arrowW = 1.0;
  const totalW = cardW * 2 + arrowW;
  const startX = (W - totalW) / 2;
  const cardY = 1.5;
  const cardH = 4.8;

  // Left card — typically "Before" / 従来
  const leftAccent = slide.left.tone === "bad" ? t.colors.bad : t.colors.textMuted;
  const leftBg = slide.left.tone === "bad" ? "FFEBEE" : t.colors.bgAlt;
  const leftIcon = slide.left.tone === "bad" ? "✕" : "•";
  drawCompareCard(s, t, {
    x: startX,
    y: cardY,
    w: cardW,
    h: cardH,
    bg: leftBg,
    accent: leftAccent,
    heading: slide.left.heading,
    items: slide.left.items,
    icon: leftIcon,
  });

  // Center arrow + optional label
  const arrowX = startX + cardW;
  const arrowY = cardY + cardH / 2 - 0.5;
  if (slide.arrowLabel) {
    s.addText(slide.arrowLabel, {
      x: arrowX - 0.3,
      y: arrowY - 0.55,
      w: arrowW + 0.6,
      h: 0.4,
      fontFace: t.fontHead,
      fontSize: 13,
      bold: true,
      color: t.colors.primary,
      align: "center",
      valign: "middle",
    });
  }
  s.addShape("rightArrow", {
    x: arrowX + 0.1,
    y: arrowY,
    w: arrowW - 0.2,
    h: 1.0,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
  });

  // Right card — typically "After" / 改善後
  const rightX = startX + cardW + arrowW;
  const rightAccent = slide.right.tone === "good" ? t.colors.good : t.colors.primary;
  const rightBg = slide.right.tone === "good" ? "E8F5E9" : t.colors.bgAlt;
  const rightIcon = slide.right.tone === "good" ? "✓" : "•";
  drawCompareCard(s, t, {
    x: rightX,
    y: cardY,
    w: cardW,
    h: cardH,
    bg: rightBg,
    accent: rightAccent,
    heading: slide.right.heading,
    items: slide.right.items,
    icon: rightIcon,
  });

  captionRow(s, slide.caption, t);
  chromeFooter(s, page, total, t);
}

function drawCompareCard(
  s: Slide_,
  t: Theme,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    bg: string;
    accent: string;
    heading: string;
    items: string[];
    icon: string;
  },
) {
  s.addShape("roundRect", {
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    fill: { color: o.bg },
    line: { color: o.accent, width: 1.5 },
    rectRadius: 0.12,
  });
  s.addText(o.heading, {
    x: o.x + 0.3,
    y: o.y + 0.2,
    w: o.w - 0.6,
    h: 0.6,
    fontFace: t.fontHead,
    fontSize: 22,
    bold: true,
    color: o.accent,
    valign: "middle",
  });
  s.addShape("line", {
    x: o.x + 0.3,
    y: o.y + 0.85,
    w: o.w - 0.6,
    h: 0,
    line: { color: o.accent, width: 1 },
  });
  o.items.slice(0, 5).forEach((it, i) => {
    const y = o.y + 1.1 + i * 0.7;
    s.addShape("ellipse", {
      x: o.x + 0.4,
      y: y + 0.05,
      w: 0.4,
      h: 0.4,
      fill: { color: o.accent },
      line: { color: o.accent, width: 0 },
    });
    s.addText(o.icon, {
      x: o.x + 0.4,
      y: y + 0.05,
      w: 0.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 16,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    s.addText(it, {
      x: o.x + 1.0,
      y,
      w: o.w - 1.3,
      h: 0.5,
      fontFace: t.fontBody,
      fontSize: 14,
      color: t.colors.text,
      valign: "middle",
    });
  });
}

// ---------------------------------------------------------------------
// Layered — N (3-5) horizontal bands stacked top→down. Each band has
// a numbered badge, heading, optional detail. Color rotates so the eye
// distinguishes layers without hard borders.
// ---------------------------------------------------------------------

function renderLayered(
  s: Slide_,
  slide: Extract<Slide, { kind: "layered" }>,
  t: Theme,
  page: number,
  total: number,
): void {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);

  // Cap at 4 layers — beyond that text becomes unreadable in the
  // 5.15-inch vertical band and the detail box collapses to negative
  // height. If LLM emits 5+ layers, drop the tail.
  const layers = slide.layers.slice(0, 4);
  const n = layers.length;
  const startY = 1.5;
  const endY = H - 0.85;
  const gap = 0.18;
  const layerH = (endY - startY - gap * (n - 1)) / n;
  // Detail body height — guarded against tight 4-layer layouts.
  const detailH = Math.max(0.18, layerH - 0.95);
  const palette = [t.colors.primary, t.colors.accent, t.colors.good, t.colors.primary, t.colors.accent];

  layers.forEach((layer, i) => {
    const y = startY + i * (layerH + gap);
    const accent = palette[i % palette.length];

    // Layer body
    s.addShape("roundRect", {
      x: 0.5,
      y,
      w: W - 1,
      h: layerH,
      fill: { color: t.colors.bgAlt },
      line: { color: accent, width: 1.5 },
      rectRadius: 0.12,
    });
    // Left accent stripe inside
    s.addShape("rect", {
      x: 0.5,
      y,
      w: 0.18,
      h: layerH,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    });
    // Numbered badge
    s.addShape("ellipse", {
      x: 0.85,
      y: y + layerH / 2 - 0.3,
      w: 0.6,
      h: 0.6,
      fill: { color: accent },
      line: { color: "FFFFFF", width: 2 },
    });
    s.addText(String(i + 1), {
      x: 0.85,
      y: y + layerH / 2 - 0.3,
      w: 0.6,
      h: 0.6,
      fontFace: t.fontHead,
      fontSize: 22,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    // Heading
    s.addText(layer.heading, {
      x: 1.7,
      y: y + 0.18,
      w: W - 2.2,
      h: 0.55,
      fontFace: t.fontHead,
      fontSize: 18,
      bold: true,
      color: accent,
      valign: "middle",
    });
    // Detail
    if (layer.detail) {
      s.addText(layer.detail, {
        x: 1.7,
        y: y + 0.78,
        w: W - 2.2,
        h: detailH,
        fontFace: t.fontBody,
        fontSize: 13,
        color: t.colors.text,
        valign: "top",
        fit: "shrink",
      });
    }
  });

  captionRow(s, slide.caption, t);
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Progress — top progress bar + state-card grid below. Each card has
// done / next / todo state with matching color tokens.
// ---------------------------------------------------------------------

function renderProgress(
  s: Slide_,
  slide: Extract<Slide, { kind: "progress" }>,
  t: Theme,
  page: number,
  total: number,
): void {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);

  const percent = Math.max(0, Math.min(100, slide.percent));
  const barX = 0.5;
  const barY = 1.6;
  const barW = W - 1;
  const barH = 0.45;

  // Label above bar
  s.addText(`Progress: ${percent}%`, {
    x: barX,
    y: barY - 0.45,
    w: 6,
    h: 0.4,
    fontFace: t.fontHead,
    fontSize: 16,
    bold: true,
    color: t.colors.primary,
    valign: "middle",
  });
  // Bar background
  s.addShape("roundRect", {
    x: barX,
    y: barY,
    w: barW,
    h: barH,
    fill: { color: t.colors.bgAlt },
    line: { color: t.colors.border, width: 0.5 },
    rectRadius: 0.08,
  });
  // Filled portion
  if (percent > 0) {
    s.addShape("roundRect", {
      x: barX,
      y: barY,
      w: (barW * percent) / 100,
      h: barH,
      fill: { color: t.colors.good },
      line: { color: t.colors.good, width: 0 },
      rectRadius: 0.08,
    });
  }

  // State cards grid
  const items = slide.items.slice(0, 8);
  const n = items.length;
  const cols = n <= 4 ? Math.max(n, 1) : 4;
  const rows = Math.ceil(n / cols);
  const gridY = 2.55;
  const gridGap = 0.15;
  const gridEndY = H - 0.85;
  const cellW = (W - 1 - gridGap * (cols - 1)) / cols;
  const cellH = (gridEndY - gridY - gridGap * (rows - 1)) / rows;

  const stateColor: Record<string, string> = {
    done: t.colors.good,
    next: t.colors.accent,
    todo: t.colors.textMuted,
  };
  const stateBg: Record<string, string> = {
    done: "E8F5E9",
    next: "FFF3E0",
    todo: t.colors.bgAlt,
  };
  const stateGlyph: Record<string, string> = {
    done: "✓ Done",
    next: "▶ Next",
    todo: "□ Todo",
  };

  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * (cellW + gridGap);
    const y = gridY + row * (cellH + gridGap);
    const accent = stateColor[it.state];
    const bg = stateBg[it.state];

    s.addShape("roundRect", {
      x,
      y,
      w: cellW,
      h: cellH,
      fill: { color: bg },
      line: { color: accent, width: 1.5 },
      rectRadius: 0.12,
    });
    // Index badge
    s.addShape("roundRect", {
      x: x + 0.2,
      y: y + 0.2,
      w: 0.7,
      h: 0.4,
      fill: { color: accent },
      line: { color: accent, width: 0 },
      rectRadius: 0.06,
    });
    s.addText(`P${i + 1}`, {
      x: x + 0.2,
      y: y + 0.2,
      w: 0.7,
      h: 0.4,
      fontFace: t.fontHead,
      fontSize: 13,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });
    // Label
    s.addText(it.label, {
      x: x + 1.0,
      y: y + 0.15,
      w: cellW - 1.2,
      h: 0.5,
      fontFace: t.fontHead,
      fontSize: 14,
      bold: true,
      color: t.colors.text,
      valign: "middle",
      fit: "shrink",
    });
    // State indicator
    s.addText(stateGlyph[it.state], {
      x: x + 0.2,
      y: y + cellH - 0.5,
      w: cellW - 0.4,
      h: 0.4,
      fontFace: t.fontBody,
      fontSize: 12,
      color: accent,
      valign: "middle",
    });
    // Note (optional)
    if (it.note) {
      s.addText(it.note, {
        x: x + 0.2,
        y: y + 0.75,
        w: cellW - 0.4,
        h: cellH - 1.3,
        fontFace: t.fontBody,
        fontSize: 11,
        color: t.colors.textMuted,
        valign: "top",
        fit: "shrink",
      });
    }
  });

  captionRow(s, slide.caption, t);
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Chart — native pptxgenjs chart object. Editable in PowerPoint.
// Supports bar / line / pie / doughnut.
// ---------------------------------------------------------------------

function renderChart(
  s: Slide_,
  slide: Extract<Slide, { kind: "chart" }>,
  t: Theme,
  page: number,
  total: number,
): void {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);

  const data = slide.series.map((srs) => ({
    name: srs.name,
    labels: slide.labels,
    values: srs.values,
  }));

  const chartColors = [
    t.colors.primary,
    t.colors.accent,
    t.colors.good,
    t.colors.bad,
    t.colors.textMuted,
    t.colors.primaryDark,
  ];

  // pptxgenjs accepts string chart types. Cast keeps TS quiet across
  // pptxgenjs versions where the enum may differ.
  const chartType = slide.chartType as unknown as Parameters<Slide_["addChart"]>[0];

  s.addChart(chartType, data, {
    x: 0.6,
    y: 1.5,
    w: W - 1.2,
    h: 4.85,
    chartColors,
    showLegend: true,
    legendPos: "b",
    legendFontSize: 12,
    legendColor: t.colors.text,
    catAxisLabelColor: t.colors.textMuted,
    catAxisLabelFontSize: 11,
    valAxisLabelColor: t.colors.textMuted,
    valAxisLabelFontSize: 11,
    showValue: false,
    barDir: "col",
    catAxisLabelFontFace: t.fontBody,
    valAxisLabelFontFace: t.fontBody,
    legendFontFace: t.fontBody,
    showTitle: false,
  });

  captionRow(s, slide.caption, t);
  chromeFooter(s, page, total, t);
}

// ---------------------------------------------------------------------
// Mockup — browser / pdf / phone window with body content. Used for
// "show what the screen looks like" slides without requiring a real
// screenshot.
// ---------------------------------------------------------------------

function renderMockup(
  s: Slide_,
  slide: Extract<Slide, { kind: "mockup" }>,
  t: Theme,
  page: number,
  total: number,
): void {
  chromeAccent(s, t);
  chromeTitle(s, slide.title, t);

  const frameX = 0.7;
  const frameY = 1.5;
  const frameW = W - 1.4;
  const frameH = H - 2.55;

  // Outer window frame
  s.addShape("roundRect", {
    x: frameX,
    y: frameY,
    w: frameW,
    h: frameH,
    fill: { color: t.colors.bg },
    line: { color: t.colors.border, width: 1.5 },
    rectRadius: 0.12,
  });

  const chromeH = 0.5;
  let chromeBg: string;
  let chromeText: string;
  let chromeFontColor = "FFFFFF";

  if (slide.mockupType === "browser") {
    chromeBg = t.colors.bgAlt;
    chromeFontColor = t.colors.text;
    // Traffic light dots + URL bar
    chromeText = `●  ●  ●     ${slide.url || "https://example.com"}`;
  } else if (slide.mockupType === "pdf") {
    chromeBg = "B71C1C";
    chromeText = `📕   ${slide.url || "Document.pdf"}`;
  } else {
    chromeBg = t.colors.primaryDark;
    chromeText = `📱   ${slide.url || "App"}`;
  }

  // Title bar
  s.addShape("rect", {
    x: frameX,
    y: frameY,
    w: frameW,
    h: chromeH,
    fill: { color: chromeBg },
    line: { color: chromeBg, width: 0 },
  });
  s.addText(chromeText, {
    x: frameX + 0.2,
    y: frameY,
    w: frameW - 0.4,
    h: chromeH,
    fontFace: t.fontBody,
    fontSize: 12,
    bold: true,
    color: chromeFontColor,
    valign: "middle",
  });

  // Body content — each line gets equal vertical share
  const bodyX = frameX + 0.35;
  const bodyY = frameY + chromeH + 0.25;
  const bodyW = frameW - 0.7;
  const bodyH = frameH - chromeH - 0.5;
  const lines = slide.bodyLines.slice(0, 12);
  if (lines.length > 0) {
    const lineGap = bodyH / lines.length;
    lines.forEach((line, i) => {
      // Subtle alternating row tint for table-like readability
      if (i % 2 === 1) {
        s.addShape("rect", {
          x: bodyX - 0.1,
          y: bodyY + i * lineGap,
          w: bodyW + 0.2,
          h: lineGap,
          fill: { color: t.colors.bgAlt },
          line: { color: t.colors.bgAlt, width: 0 },
        });
      }
      s.addText(line, {
        x: bodyX,
        y: bodyY + i * lineGap,
        w: bodyW,
        h: lineGap,
        fontFace: t.fontBody,
        fontSize: 14,
        color: t.colors.text,
        valign: "middle",
      });
    });
  }

  captionRow(s, slide.caption, t);
  chromeFooter(s, page, total, t);
}
