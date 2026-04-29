import type { Deck, Slide } from "../types";

// ざっくり md → Deck の変換。
// # = カバー / ## = 各スライド / -, * = 箇条書き / | ... | = 表 / > = 引用
export function parseMarkdown(md: string): Deck {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const slides: Slide[] = [];
  let cover: { title: string; subtitle?: string; tagline?: string } | null = null;
  let current: { title: string; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    slides.push(linesToSlide(current.title, current.lines));
    current = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    if (h1) {
      flush();
      cover = { title: h1[1].trim() };
      continue;
    }
    if (h2) {
      flush();
      current = { title: h2[1].trim(), lines: [] };
      continue;
    }
    if (cover && !current) {
      const sub = line.match(/^>\s*サブタイトル\s*[:：]\s*(.+)$/);
      const tag = line.match(/^>\s*タグライン\s*[:：]\s*(.+)$/) || line.match(/^>\s*副題\s*[:：]\s*(.+)$/);
      if (sub) cover.subtitle = sub[1].trim();
      else if (tag) cover.tagline = tag[1].trim();
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  const out: Slide[] = [];
  if (cover) {
    out.push({
      kind: "cover",
      title: cover.title,
      subtitle: cover.subtitle,
      tagline: cover.tagline,
    });
  }
  out.push(...slides);
  return { title: cover?.title ?? "Untitled Deck", slides: out };
}

function linesToSlide(title: string, lines: string[]): Slide {
  // SECTION 01 / Section 1 / 第1章 / 章 1 — chapter divider with a
  // big rendered numeral. Caller writes ## SECTION 01: 章タイトル.
  const sectionMatch = title.match(
    /^(?:SECTION|Section|セクション|第)?\s*(\d{1,2})(?:章)?\s*[:：\-—]\s*(.+)$/,
  );
  if (sectionMatch && /^(SECTION|Section|セクション|第)/.test(title)) {
    const idx = sectionMatch[1].padStart(2, "0");
    const heading = sectionMatch[2].trim();
    // Subtitle: first non-empty quoted line, e.g. "> 副題: ..."
    const sub = lines
      .map((l) => l.trim())
      .find((l) => /^>/.test(l));
    return {
      kind: "section",
      index: idx,
      title: heading,
      subtitle: sub ? sub.replace(/^>\s*/, "") : undefined,
    };
  }

  // STAT 30%: KPI 改善 — single big-number callout. Format:
  //   ## STAT 30%: 前年比成長率
  // The body's first non-empty line becomes the optional detail.
  const statMatch = title.match(/^STAT\s+(.+?)\s*[:：]\s*(.+)$/);
  if (statMatch) {
    const detail = lines.map((l) => l.trim()).find((l) => l.length > 0);
    return {
      kind: "stat",
      value: statMatch[1].trim(),
      label: statMatch[2].trim(),
      detail,
    };
  }

  const tableLines = lines.filter((l) => l.trim().startsWith("|"));
  if (tableLines.length >= 2) {
    return parseTable(title, tableLines);
  }
  const quoteLines = lines.filter((l) => l.trim().startsWith(">"));
  if (
    quoteLines.length >= 1 &&
    lines.filter((l) => l.trim()).length === quoteLines.length
  ) {
    return {
      kind: "quote",
      title,
      quote: quoteLines.map((l) => l.replace(/^>\s?/, "").trim()).join(" "),
    };
  }
  const items = lines
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s+/.test(l) || /^[✅🔜⏳🎯⭐]/u.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, ""));
  if (items.length === 0) {
    return {
      kind: "bullets",
      title,
      items: lines.map((l) => l.trim()).filter(Boolean),
    };
  }
  if (/まとめ|summary|結論/i.test(title)) {
    return { kind: "summary", title, items };
  }
  return { kind: "bullets", title, items };
}

function parseTable(title: string, tableLines: string[]): Slide {
  const rows = tableLines
    .map((l) => l.trim())
    .filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
    .map((l) =>
      l
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    );
  if (rows.length < 2) {
    return { kind: "bullets", title, items: tableLines };
  }
  const [headers, ...body] = rows;
  return { kind: "table", title, headers, rows: body };
}
