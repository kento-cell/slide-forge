/**
 * Minimal design pack — strips all decorative chrome from the v4-style
 * consulting pack (vertical accent bars, corner ornaments, dot trios,
 * numbered badges, brand footer band) and instead leans on:
 *
 *   - generous whitespace (huge top/side margins)
 *   - large headline typography (32-72pt)
 *   - single thin accent line for visual rhythm
 *   - subtle muted page number top-right
 *   - bottom italic caption row preserved (it's information, not chrome)
 *
 * Use when the deck should read like Apple Keynote / TED talk rather
 * than McKinsey report. Picked via settings.pack = "minimal" in the
 * UI pack selector or via prompt directive in a future revision.
 */

import PptxGenJS from "pptxgenjs";
import type { Slide, ThemeId } from "../../types";
import { THEMES } from "../themes";

const W = 13.33;
const H = 7.5;

type Slide_ = NonNullable<ReturnType<PptxGenJS["addSlide"]>>;
type Theme = (typeof THEMES)[ThemeId];

// ---------------------------------------------------------------------
// Shared minimal helpers — intentionally subtle. Anything that draws a
// shape needs to justify its existence; default is to NOT draw.
// ---------------------------------------------------------------------

function pageNum(s: Slide_, page: number, total: number, t: Theme) {
  s.addText(`${page} / ${total}`, {
    x: W - 1.5,
    y: 0.3,
    w: 1.2,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 10,
    color: t.colors.textMuted,
    align: "right",
    valign: "middle",
  });
}

function captionLine(s: Slide_, text: string | undefined, t: Theme) {
  if (!text || !text.trim()) return;
  s.addText(text.trim(), {
    x: 1.0,
    y: H - 0.65,
    w: W - 2,
    h: 0.4,
    fontFace: t.fontBody,
    fontSize: 11,
    italic: true,
    color: t.colors.textMuted,
    align: "center",
    valign: "middle",
    fit: "shrink",
  });
}

/** Title bar shared by content slides. Big serif title + thin accent
 *  rule below. No background block, no icons. */
function titleBlock(s: Slide_, title: string, t: Theme) {
  s.addText(title, {
    x: 1.0,
    y: 0.7,
    w: W - 2,
    h: 0.8,
    fontFace: t.fontHead,
    fontSize: 32,
    bold: false,
    color: t.colors.text,
    valign: "middle",
  });
  s.addShape("line", {
    x: 1.0,
    y: 1.55,
    w: 1.5,
    h: 0,
    line: { color: t.colors.primary, width: 1.25 },
  });
}

// ---------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------

export function renderMinimalSlide(
  s: Slide_,
  slide: Slide,
  theme: Theme,
  page: number,
  total: number,
): void {
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
// Cover — Apple Keynote feel: huge centered title, sparse, single line.
// ---------------------------------------------------------------------

function renderCover(s: Slide_, slide: Extract<Slide, { kind: "cover" }>, t: Theme) {
  if (slide.image) {
    s.addImage({
      data: slide.image.dataUrl,
      x: 0,
      y: 0,
      w: W,
      h: H,
      sizing: { type: "cover", w: W, h: H },
    });
    s.addShape("rect", {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: "FFFFFF", transparency: 30 },
      line: { color: "FFFFFF", width: 0 },
    });
  }
  s.addText(slide.title, {
    x: 1.0,
    y: 2.5,
    w: W - 2,
    h: 1.6,
    fontFace: t.fontHead,
    fontSize: 60,
    bold: false,
    color: t.colors.text,
    align: "center",
    valign: "middle",
    fit: "shrink",
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 1.0,
      y: 4.3,
      w: W - 2,
      h: 0.5,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.textMuted,
      align: "center",
    });
  }
  s.addShape("line", {
    x: W / 2 - 0.5,
    y: H - 2.0,
    w: 1.0,
    h: 0,
    line: { color: t.colors.primary, width: 1.5 },
  });
  if (slide.tagline) {
    s.addText(slide.tagline, {
      x: 1.0,
      y: H - 1.6,
      w: W - 2,
      h: 0.4,
      fontFace: t.fontBody,
      fontSize: 13,
      color: t.colors.textMuted,
      align: "center",
    });
  }
}

// ---------------------------------------------------------------------
// Bullets — large left-aligned items with hanging dot. No badges.
// ---------------------------------------------------------------------

function renderBullets(
  s: Slide_,
  slide: Extract<Slide, { kind: "bullets" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const items = slide.items.slice(0, 6);
  const startY = 2.3;
  const gap = 0.75;
  const hasImage = !!slide.image;
  const textW = hasImage ? (W - 2) * 0.55 : W - 2;
  if (hasImage && slide.image) {
    const imgX = 1.0 + textW + 0.5;
    const imgY = 2.0;
    const imgW = W - imgX - 1.0;
    const imgH = H - 2.5;
    s.addImage({
      data: slide.image.dataUrl,
      x: imgX,
      y: imgY,
      w: imgW,
      h: imgH,
      sizing: { type: "cover", w: imgW, h: imgH },
    });
  }
  items.forEach((item, i) => {
    const y = startY + i * gap;
    s.addText("·", {
      x: 1.0,
      y,
      w: 0.3,
      h: gap,
      fontFace: t.fontHead,
      fontSize: 22,
      color: t.colors.primary,
      valign: "top",
    });
    s.addText(item, {
      x: 1.35,
      y,
      w: textW - 0.4,
      h: gap,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.text,
      valign: "top",
    });
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Two-column — thin vertical divider, plain text both sides.
// ---------------------------------------------------------------------

function renderTwoColumn(
  s: Slide_,
  slide: Extract<Slide, { kind: "two-column" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const colY = 2.2;
  const colH = 4.0;
  s.addShape("line", {
    x: W / 2,
    y: colY,
    w: 0,
    h: colH,
    line: { color: t.colors.border, width: 0.75 },
  });
  ([
    { col: slide.left, x: 1.0 },
    { col: slide.right, x: W / 2 + 0.4 },
  ] as const).forEach(({ col, x }) => {
    if (col.heading) {
      s.addText(col.heading, {
        x,
        y: colY,
        w: W / 2 - 1.4,
        h: 0.5,
        fontFace: t.fontHead,
        fontSize: 16,
        bold: true,
        color: t.colors.primary,
        valign: "middle",
      });
    }
    col.items.slice(0, 6).forEach((it, i) => {
      s.addText(`· ${it}`, {
        x,
        y: colY + 0.7 + i * 0.55,
        w: W / 2 - 1.4,
        h: 0.45,
        fontFace: t.fontBody,
        fontSize: 14,
        color: t.colors.text,
        valign: "middle",
      });
    });
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Table — borderless, horizontal rules only, banded rows.
// ---------------------------------------------------------------------

function renderTable(
  s: Slide_,
  slide: Extract<Slide, { kind: "table" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const headerRow = slide.headers.map((h) => ({
    text: h,
    options: {
      bold: true,
      color: t.colors.primary,
      align: "left" as const,
      valign: "middle" as const,
    },
  }));
  const bodyRows = slide.rows.slice(0, 8).map((r) =>
    r.map((c) => ({
      text: c,
      options: { color: t.colors.text, valign: "middle" as const },
    })),
  );
  s.addTable([headerRow, ...bodyRows], {
    x: 1.0,
    y: 2.0,
    w: W - 2,
    fontFace: t.fontBody,
    fontSize: 13,
    border: [
      { type: "solid", pt: 0.5, color: t.colors.border },
      { type: "none" },
      { type: "solid", pt: 0.5, color: t.colors.border },
      { type: "none" },
    ],
    rowH: 0.5,
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Quote — centered italic, no big quotation marks, cite below.
// ---------------------------------------------------------------------

function renderQuote(
  s: Slide_,
  slide: Extract<Slide, { kind: "quote" }>,
  t: Theme,
  page: number,
  total: number,
) {
  if (slide.title) {
    s.addText(slide.title, {
      x: 1.0,
      y: 0.5,
      w: W - 2,
      h: 0.5,
      fontFace: t.fontBody,
      fontSize: 14,
      color: t.colors.textMuted,
      align: "center",
    });
  }
  s.addText(slide.quote, {
    x: 1.5,
    y: 2.5,
    w: W - 3,
    h: 2.5,
    fontFace: t.fontHead,
    fontSize: 32,
    italic: true,
    color: t.colors.text,
    align: "center",
    valign: "middle",
    fit: "shrink",
  });
  s.addShape("line", {
    x: W / 2 - 0.4,
    y: 5.4,
    w: 0.8,
    h: 0,
    line: { color: t.colors.primary, width: 1 },
  });
  if (slide.cite) {
    s.addText(slide.cite, {
      x: 1.0,
      y: 5.6,
      w: W - 2,
      h: 0.4,
      fontFace: t.fontBody,
      fontSize: 13,
      color: t.colors.textMuted,
      align: "center",
    });
  }
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Summary — same as bullets but items get a subtle "→" prefix.
// ---------------------------------------------------------------------

function renderSummary(
  s: Slide_,
  slide: Extract<Slide, { kind: "summary" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const items = slide.items.slice(0, 6);
  items.forEach((it, i) => {
    const y = 2.3 + i * 0.75;
    s.addText("→", {
      x: 1.0,
      y,
      w: 0.4,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.primary,
      valign: "top",
    });
    s.addText(it, {
      x: 1.5,
      y,
      w: W - 2.5,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.text,
      valign: "top",
    });
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Section — chapter index huge but in muted grey, title below.
// ---------------------------------------------------------------------

function renderSection(
  s: Slide_,
  slide: Extract<Slide, { kind: "section" }>,
  t: Theme,
  page: number,
  total: number,
) {
  s.addText(slide.index, {
    x: 1.0,
    y: 1.5,
    w: W - 2,
    h: 3.0,
    fontFace: t.fontHead,
    fontSize: 200,
    bold: false,
    color: t.colors.bgAlt,
    align: "center",
    valign: "middle",
  });
  s.addShape("line", {
    x: W / 2 - 1.0,
    y: 4.6,
    w: 2.0,
    h: 0,
    line: { color: t.colors.primary, width: 1.5 },
  });
  s.addText(slide.title, {
    x: 1.0,
    y: 4.8,
    w: W - 2,
    h: 0.9,
    fontFace: t.fontHead,
    fontSize: 36,
    color: t.colors.text,
    align: "center",
    valign: "top",
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 1.0,
      y: 5.8,
      w: W - 2,
      h: 0.5,
      fontFace: t.fontBody,
      fontSize: 16,
      color: t.colors.textMuted,
      align: "center",
    });
  }
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Stat — single huge centered number, no decorations.
// ---------------------------------------------------------------------

function renderStat(
  s: Slide_,
  slide: Extract<Slide, { kind: "stat" }>,
  t: Theme,
  page: number,
  total: number,
) {
  s.addText(slide.value, {
    x: 0.5,
    y: 1.8,
    w: W - 1,
    h: 3.5,
    fontFace: t.fontHead,
    fontSize: 200,
    bold: false,
    color: t.colors.primary,
    align: "center",
    valign: "middle",
    fit: "shrink",
  });
  s.addShape("line", {
    x: W / 2 - 0.6,
    y: 5.4,
    w: 1.2,
    h: 0,
    line: { color: t.colors.primary, width: 1 },
  });
  s.addText(slide.label, {
    x: 0.5,
    y: 5.6,
    w: W - 1,
    h: 0.5,
    fontFace: t.fontHead,
    fontSize: 22,
    color: t.colors.text,
    align: "center",
    valign: "middle",
  });
  if (slide.detail) {
    s.addText(slide.detail, {
      x: 1.0,
      y: 6.2,
      w: W - 2,
      h: 0.5,
      fontFace: t.fontBody,
      fontSize: 13,
      color: t.colors.textMuted,
      align: "center",
    });
  }
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Image — fills with margin, no frame.
// ---------------------------------------------------------------------

function renderImage(
  s: Slide_,
  slide: Extract<Slide, { kind: "image" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const box = { x: 1.0, y: 2.0, w: W - 2, h: 4.4 };
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
      x: 1.0,
      y: 6.55,
      w: W - 2,
      h: 0.32,
      fontFace: t.fontBody,
      fontSize: 11,
      italic: true,
      color: t.colors.textMuted,
      align: "center",
      fit: "shrink",
    });
  }
  pageNum(s, page, total, t);
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
// Process — text steps separated by → arrows. No cards, no badges.
// ---------------------------------------------------------------------

function renderProcess(
  s: Slide_,
  slide: Extract<Slide, { kind: "process" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const steps = slide.steps.slice(0, 5);
  const n = steps.length;
  const margin = 1.0;
  const arrowW = 0.5;
  const stepW = (W - margin * 2 - arrowW * (n - 1)) / n;
  const startY = 3.2;

  steps.forEach((step, i) => {
    const x = margin + i * (stepW + arrowW);
    s.addText(String(i + 1).padStart(2, "0"), {
      x,
      y: startY - 0.4,
      w: stepW,
      h: 0.4,
      fontFace: t.fontHead,
      fontSize: 12,
      color: t.colors.primary,
      align: "center",
    });
    s.addText(step.label, {
      x,
      y: startY,
      w: stepW,
      h: 0.6,
      fontFace: t.fontHead,
      fontSize: 18,
      color: t.colors.text,
      align: "center",
      valign: "middle",
    });
    if (step.detail) {
      s.addText(step.detail, {
        x,
        y: startY + 0.7,
        w: stepW,
        h: 0.8,
        fontFace: t.fontBody,
        fontSize: 12,
        color: t.colors.textMuted,
        align: "center",
        valign: "top",
      });
    }
    if (i < n - 1) {
      s.addText("→", {
        x: x + stepW,
        y: startY,
        w: arrowW,
        h: 0.6,
        fontFace: t.fontHead,
        fontSize: 24,
        color: t.colors.primary,
        align: "center",
        valign: "middle",
      });
    }
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Cards — 3 plain text columns, thin vertical dividers between.
// ---------------------------------------------------------------------

function renderCards(
  s: Slide_,
  slide: Extract<Slide, { kind: "cards" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const cards = slide.cards.slice(0, 3);
  const n = cards.length;
  const margin = 1.0;
  const cellW = (W - margin * 2) / n;
  const startY = 2.4;
  const cellH = 4.0;

  cards.forEach((card, i) => {
    const x = margin + i * cellW;
    if (i > 0) {
      s.addShape("line", {
        x,
        y: startY,
        w: 0,
        h: cellH,
        line: { color: t.colors.border, width: 0.75 },
      });
    }
    s.addText(String(i + 1).padStart(2, "0"), {
      x: x + 0.3,
      y: startY,
      w: cellW - 0.6,
      h: 0.4,
      fontFace: t.fontHead,
      fontSize: 14,
      color: t.colors.primary,
    });
    s.addText(card.heading, {
      x: x + 0.3,
      y: startY + 0.5,
      w: cellW - 0.6,
      h: 0.7,
      fontFace: t.fontHead,
      fontSize: 18,
      color: t.colors.text,
    });
    s.addText(card.body, {
      x: x + 0.3,
      y: startY + 1.4,
      w: cellW - 0.6,
      h: cellH - 1.5,
      fontFace: t.fontBody,
      fontSize: 13,
      color: t.colors.textMuted,
      valign: "top",
    });
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Compare — left/right text columns, thin → between, no cards.
// ---------------------------------------------------------------------

function renderCompare(
  s: Slide_,
  slide: Extract<Slide, { kind: "compare" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const colW = (W - 2 - 0.8) / 2;
  const colY = 2.2;

  ([
    { col: slide.left, x: 1.0, color: slide.left.tone === "bad" ? t.colors.bad : t.colors.textMuted },
    { col: slide.right, x: 1.0 + colW + 0.8, color: slide.right.tone === "good" ? t.colors.good : t.colors.primary },
  ] as const).forEach(({ col, x, color }) => {
    s.addText(col.heading, {
      x,
      y: colY,
      w: colW,
      h: 0.5,
      fontFace: t.fontHead,
      fontSize: 18,
      color,
      bold: true,
    });
    s.addShape("line", {
      x,
      y: colY + 0.55,
      w: colW,
      h: 0,
      line: { color, width: 0.75 },
    });
    col.items.slice(0, 5).forEach((it, i) => {
      s.addText(`· ${it}`, {
        x,
        y: colY + 0.8 + i * 0.55,
        w: colW,
        h: 0.5,
        fontFace: t.fontBody,
        fontSize: 14,
        color: t.colors.text,
        valign: "middle",
      });
    });
  });

  s.addText("→", {
    x: 1.0 + colW + 0.1,
    y: colY + 1.5,
    w: 0.6,
    h: 0.6,
    fontFace: t.fontHead,
    fontSize: 28,
    color: t.colors.primary,
    align: "center",
    valign: "middle",
  });
  if (slide.arrowLabel) {
    s.addText(slide.arrowLabel, {
      x: 1.0 + colW + 0.0,
      y: colY + 2.1,
      w: 0.8,
      h: 0.4,
      fontFace: t.fontBody,
      fontSize: 11,
      color: t.colors.textMuted,
      align: "center",
    });
  }
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Layered — stacked text rows separated by thin horizontal lines.
// ---------------------------------------------------------------------

function renderLayered(
  s: Slide_,
  slide: Extract<Slide, { kind: "layered" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const layers = slide.layers.slice(0, 4);
  const n = layers.length;
  const startY = 2.2;
  const endY = H - 0.85;
  const layerH = (endY - startY) / n;

  layers.forEach((layer, i) => {
    const y = startY + i * layerH;
    if (i > 0) {
      s.addShape("line", {
        x: 1.0,
        y,
        w: W - 2,
        h: 0,
        line: { color: t.colors.border, width: 0.5 },
      });
    }
    s.addText(String(i + 1).padStart(2, "0"), {
      x: 1.0,
      y: y + 0.15,
      w: 0.6,
      h: 0.5,
      fontFace: t.fontHead,
      fontSize: 16,
      color: t.colors.primary,
    });
    s.addText(layer.heading, {
      x: 1.7,
      y: y + 0.15,
      w: W - 2.7,
      h: 0.5,
      fontFace: t.fontHead,
      fontSize: 18,
      color: t.colors.text,
    });
    if (layer.detail) {
      s.addText(layer.detail, {
        x: 1.7,
        y: y + 0.7,
        w: W - 2.7,
        h: layerH - 0.85,
        fontFace: t.fontBody,
        fontSize: 13,
        color: t.colors.textMuted,
        valign: "top",
        fit: "shrink",
      });
    }
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Progress — thin rule with filled portion + text-only items below.
// ---------------------------------------------------------------------

function renderProgress(
  s: Slide_,
  slide: Extract<Slide, { kind: "progress" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const percent = Math.max(0, Math.min(100, slide.percent));
  const barX = 1.0;
  const barY = 2.3;
  const barW = W - 2;
  const barH = 0.06;

  s.addText(`${percent}%`, {
    x: barX,
    y: barY - 0.5,
    w: barW,
    h: 0.4,
    fontFace: t.fontHead,
    fontSize: 18,
    color: t.colors.primary,
    align: "left",
  });
  s.addShape("rect", {
    x: barX,
    y: barY,
    w: barW,
    h: barH,
    fill: { color: t.colors.border },
    line: { color: t.colors.border, width: 0 },
  });
  if (percent > 0) {
    s.addShape("rect", {
      x: barX,
      y: barY,
      w: (barW * percent) / 100,
      h: barH,
      fill: { color: t.colors.primary },
      line: { color: t.colors.primary, width: 0 },
    });
  }

  const items = slide.items.slice(0, 8);
  items.forEach((it, i) => {
    const y = 3.0 + i * 0.45;
    const stateColor =
      it.state === "done"
        ? t.colors.good
        : it.state === "next"
          ? t.colors.accent
          : t.colors.textMuted;
    const glyph =
      it.state === "done" ? "✓" : it.state === "next" ? "▶" : "□";
    s.addText(glyph, {
      x: 1.0,
      y,
      w: 0.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 14,
      color: stateColor,
    });
    s.addText(it.label, {
      x: 1.5,
      y,
      w: W - 3.0,
      h: 0.4,
      fontFace: t.fontBody,
      fontSize: 14,
      color: t.colors.text,
    });
    if (it.note) {
      s.addText(it.note, {
        x: W - 3.5,
        y,
        w: 2.5,
        h: 0.4,
        fontFace: t.fontBody,
        fontSize: 11,
        color: t.colors.textMuted,
        align: "right",
      });
    }
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Chart — same native pptxgenjs chart, but minimal palette + layout.
// ---------------------------------------------------------------------

function renderChart(
  s: Slide_,
  slide: Extract<Slide, { kind: "chart" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const data = slide.series.map((srs) => ({
    name: srs.name,
    labels: slide.labels,
    values: srs.values,
  }));
  const chartColors = [
    t.colors.primary,
    t.colors.textMuted,
    t.colors.accent,
    t.colors.good,
  ];
  const chartType = slide.chartType as unknown as Parameters<Slide_["addChart"]>[0];
  s.addChart(chartType, data, {
    x: 1.0,
    y: 2.0,
    w: W - 2,
    h: 4.5,
    chartColors,
    showLegend: true,
    legendPos: "b",
    legendFontSize: 11,
    legendColor: t.colors.textMuted,
    catAxisLabelColor: t.colors.textMuted,
    catAxisLabelFontSize: 10,
    valAxisLabelColor: t.colors.textMuted,
    valAxisLabelFontSize: 10,
    showValue: false,
    barDir: "col",
    catAxisLabelFontFace: t.fontBody,
    valAxisLabelFontFace: t.fontBody,
    legendFontFace: t.fontBody,
    showTitle: false,
  });
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}

// ---------------------------------------------------------------------
// Mockup — thin frame, sparse content, no traffic-light dots.
// ---------------------------------------------------------------------

function renderMockup(
  s: Slide_,
  slide: Extract<Slide, { kind: "mockup" }>,
  t: Theme,
  page: number,
  total: number,
) {
  titleBlock(s, slide.title, t);
  const frameX = 1.5;
  const frameY = 2.0;
  const frameW = W - 3.0;
  const frameH = H - 3.0;
  s.addShape("rect", {
    x: frameX,
    y: frameY,
    w: frameW,
    h: frameH,
    fill: { color: t.colors.bg },
    line: { color: t.colors.border, width: 0.75 },
  });
  s.addShape("line", {
    x: frameX,
    y: frameY + 0.4,
    w: frameW,
    h: 0,
    line: { color: t.colors.border, width: 0.5 },
  });
  s.addText(slide.url || slide.mockupType, {
    x: frameX + 0.3,
    y: frameY,
    w: frameW - 0.6,
    h: 0.4,
    fontFace: t.fontBody,
    fontSize: 11,
    color: t.colors.textMuted,
    valign: "middle",
  });
  const lines = slide.bodyLines.slice(0, 8);
  if (lines.length > 0) {
    const lineGap = (frameH - 0.6) / lines.length;
    lines.forEach((line, i) => {
      s.addText(line, {
        x: frameX + 0.4,
        y: frameY + 0.5 + i * lineGap,
        w: frameW - 0.8,
        h: lineGap,
        fontFace: t.fontBody,
        fontSize: 13,
        color: t.colors.text,
        valign: "middle",
      });
    });
  }
  captionLine(s, slide.caption, t);
  pageNum(s, page, total, t);
}
