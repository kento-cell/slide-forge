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

function renderSlide(
  s: Slide_,
  slide: Slide,
  theme: ReturnType<typeof getTheme>,
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
  }
}

function getTheme(id: ThemeId) {
  return THEMES[id];
}

function actionTitle(s: Slide_, title: string, t: ReturnType<typeof getTheme>) {
  s.addText(title, {
    x: 0.5,
    y: 0.3,
    w: W - 1,
    h: 0.7,
    fontFace: t.fontHead,
    fontSize: 24,
    bold: true,
    color: t.colors.primary,
  });
  s.addShape("line", {
    x: 0.5,
    y: 1.07,
    w: W - 1,
    h: 0,
    line: { color: t.colors.primary, width: 1 },
  });
}

function pageNo(s: Slide_, p: number, total: number, t: ReturnType<typeof getTheme>) {
  s.addText(`${p} / ${total}`, {
    x: W - 1.4,
    y: H - 0.45,
    w: 1.0,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 11,
    color: t.colors.textMuted,
    align: "right",
  });
}

function renderCover(s: Slide_, slide: Extract<Slide, { kind: "cover" }>, t: ReturnType<typeof getTheme>) {
  s.background = { color: t.colors.primaryDark };
  s.addShape("ellipse", {
    x: W - 2.5,
    y: -1.5,
    w: 5,
    h: 5,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
  });
  s.addShape("ellipse", {
    x: -1.5,
    y: H - 2.0,
    w: 4,
    h: 4,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
  });
  s.addText(slide.title, {
    x: 0.7,
    y: 2.5,
    w: W - 1.4,
    h: 1.4,
    fontFace: t.fontHead,
    fontSize: 50,
    bold: true,
    color: "FFFFFF",
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.7,
      y: 4.0,
      w: W - 1.4,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 22,
      color: "EAF1FA",
    });
  }
  s.addShape("rect", {
    x: 0.7,
    y: 5.2,
    w: 0.15,
    h: 1.2,
    fill: { color: t.colors.accent },
    line: { color: t.colors.accent, width: 0 },
  });
  if (slide.tagline) {
    s.addText(slide.tagline, {
      x: 1.0,
      y: 5.2,
      w: W - 2,
      h: 1.2,
      fontFace: t.fontHead,
      fontSize: 16,
      bold: true,
      color: "FFFFFF",
      valign: "top",
    });
  }
}

function renderBullets(
  s: Slide_,
  slide: Extract<Slide, { kind: "bullets" }>,
  t: ReturnType<typeof getTheme>,
  page: number,
  total: number,
) {
  actionTitle(s, slide.title, t);
  const items = slide.items.slice(0, 8);
  const startY = 1.5;
  const gap = 0.7;
  items.forEach((item, i) => {
    const y = startY + i * gap;
    s.addShape("ellipse", {
      x: 0.7,
      y: y + 0.18,
      w: 0.18,
      h: 0.18,
      fill: { color: t.colors.accent },
      line: { color: t.colors.accent, width: 0 },
    });
    s.addText(item, {
      x: 1.05,
      y,
      w: W - 1.6,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.text,
      valign: "middle",
    });
  });
  pageNo(s, page, total, t);
}

function renderTwoColumn(
  s: Slide_,
  slide: Extract<Slide, { kind: "two-column" }>,
  t: ReturnType<typeof getTheme>,
  page: number,
  total: number,
) {
  actionTitle(s, slide.title, t);
  const half = (W - 1.5) / 2;
  ([
    { col: slide.left, x: 0.5 },
    { col: slide.right, x: 0.5 + half + 0.5 },
  ] as const).forEach(({ col, x }) => {
    s.addShape("roundRect", {
      x,
      y: 1.4,
      w: half,
      h: 5.0,
      fill: { color: t.colors.bgAlt },
      line: { color: t.colors.border, width: 1 },
      rectRadius: 0.1,
    });
    if (col.heading) {
      s.addText(col.heading, {
        x: x + 0.2,
        y: 1.55,
        w: half - 0.4,
        h: 0.5,
        fontFace: t.fontHead,
        fontSize: 20,
        bold: true,
        color: t.colors.primary,
      });
    }
    col.items.slice(0, 6).forEach((it, i) => {
      s.addText(`• ${it}`, {
        x: x + 0.3,
        y: 2.2 + i * 0.6,
        w: half - 0.6,
        h: 0.5,
        fontFace: t.fontBody,
        fontSize: 14,
        color: t.colors.text,
        valign: "middle",
      });
    });
  });
  pageNo(s, page, total, t);
}

function renderTable(
  s: Slide_,
  slide: Extract<Slide, { kind: "table" }>,
  t: ReturnType<typeof getTheme>,
  page: number,
  total: number,
) {
  actionTitle(s, slide.title, t);
  const rows = [
    slide.headers.map((h) => ({
      text: h,
      options: {
        bold: true,
        color: "FFFFFF",
        fill: { color: t.colors.primary },
        align: "left" as const,
      },
    })),
    ...slide.rows.slice(0, 8).map((r) =>
      r.map((c) => ({
        text: c,
        options: { color: t.colors.text },
      })),
    ),
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 1.4,
    w: W - 1,
    fontFace: t.fontBody,
    fontSize: 14,
    border: { type: "solid", pt: 0.5, color: t.colors.border },
    rowH: 0.5,
  });
  pageNo(s, page, total, t);
}

function renderQuote(
  s: Slide_,
  slide: Extract<Slide, { kind: "quote" }>,
  t: ReturnType<typeof getTheme>,
  page: number,
  total: number,
) {
  if (slide.title) actionTitle(s, slide.title, t);
  s.addShape("rect", {
    x: 1.5,
    y: 2.5,
    w: 0.15,
    h: 2.5,
    fill: { color: t.colors.accent },
    line: { color: t.colors.accent, width: 0 },
  });
  s.addText(`“${slide.quote}”`, {
    x: 1.9,
    y: 2.5,
    w: W - 3,
    h: 2.5,
    fontFace: t.fontHead,
    fontSize: 28,
    italic: true,
    color: t.colors.text,
    valign: "middle",
  });
  if (slide.cite) {
    s.addText(`— ${slide.cite}`, {
      x: 1.9,
      y: 5.2,
      w: W - 3,
      h: 0.4,
      fontFace: t.fontBody,
      fontSize: 14,
      color: t.colors.textMuted,
    });
  }
  pageNo(s, page, total, t);
}

function renderSummary(
  s: Slide_,
  slide: Extract<Slide, { kind: "summary" }>,
  t: ReturnType<typeof getTheme>,
  page: number,
  total: number,
) {
  actionTitle(s, slide.title, t);
  slide.items.slice(0, 6).forEach((it, i) => {
    s.addText(it, {
      x: 0.7,
      y: 1.6 + i * 0.7,
      w: W - 1.4,
      h: 0.6,
      fontFace: t.fontBody,
      fontSize: 18,
      color: t.colors.text,
      valign: "middle",
    });
  });
  s.addShape("roundRect", {
    x: 0.5,
    y: H - 1.0,
    w: W - 1,
    h: 0.7,
    fill: { color: t.colors.primary },
    line: { color: t.colors.primary, width: 0 },
    rectRadius: 0.08,
  });
  s.addText("Generated by Slide Forge", {
    x: 0.5,
    y: H - 1.0,
    w: W - 1,
    h: 0.7,
    fontFace: t.fontBody,
    fontSize: 12,
    color: "FFFFFF",
    align: "center",
    valign: "middle",
  });
  pageNo(s, page, total, t);
}
