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

// Strip a "> キャプション: ..." (or "> caption: ...") line out of a
// slide body. The captured text becomes the slide-level caption shown
// at the bottom of the rendered slide. Returns the remaining body lines.
function extractCaption(lines: string[]): { caption?: string; rest: string[] } {
  const re = /^>\s*(?:キャプション|caption)\s*[:：]\s*(.+)$/i;
  let caption: string | undefined;
  const rest: string[] = [];
  for (const line of lines) {
    const m = line.trim().match(re);
    if (m) caption = m[1].trim();
    else rest.push(line);
  }
  return { caption, rest };
}

function linesToSlide(title: string, originalLines: string[]): Slide {
  const { caption, rest: lines } = extractCaption(originalLines);
  const slide = linesToSlideInner(title, lines);
  if (caption && supportsCaption(slide.kind)) {
    (slide as { caption?: string }).caption = caption;
  }
  return slide;
}

function supportsCaption(kind: Slide["kind"]): boolean {
  return (
    kind !== "cover" &&
    kind !== "section" &&
    kind !== "stat" &&
    kind !== "image"
  );
}

function linesToSlideInner(title: string, lines: string[]): Slide {
  // SECTION 01 / Section 1 / 第1章 / 章 1 — chapter divider with a
  // big rendered numeral. Caller writes ## SECTION 01: 章タイトル.
  const sectionMatch = title.match(
    /^(?:SECTION|Section|セクション|第)?\s*(\d{1,2})(?:章)?\s*[:：\-—]\s*(.+)$/,
  );
  if (sectionMatch && /^(SECTION|Section|セクション|第)/.test(title)) {
    const idx = sectionMatch[1].padStart(2, "0");
    const heading = sectionMatch[2].trim();
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

  // FLOW: 手順1 / 手順2 / 手順3 — process arrow chain.
  const flowMatch = title.match(/^FLOW(?:\s+(.+))?$/);
  if (flowMatch) {
    const flowTitle = flowMatch[1]?.trim() || "プロセスフロー";
    const stepLines = lines
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, ""));
    if (stepLines.length >= 2) {
      const steps = stepLines.slice(0, 5).map((line) => {
        const [label, ...rest] = line.split("|").map((s) => s.trim());
        return { label, detail: rest.length ? rest.join(" / ") : undefined };
      });
      return { kind: "process", title: flowTitle, steps };
    }
  }

  // CARDS: 3 cards in a row. Body uses 3 bullet lines, each
  //   "見出し | 説明文"
  const cardsMatch = title.match(/^CARDS(?:\s+(.+))?$/);
  if (cardsMatch) {
    const cardsTitle = cardsMatch[1]?.trim() || "ハイライト";
    const cardLines = lines
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, ""))
      .filter((l) => l.includes("|"));
    if (cardLines.length >= 2) {
      const cards = cardLines.slice(0, 3).map((line) => {
        const [heading, ...rest] = line.split("|").map((s) => s.trim());
        return { heading, body: rest.join(" / ") };
      });
      return { kind: "cards", title: cardsTitle, cards };
    }
  }

  // COMPARE: Before → arrow → After. Body uses ### subheadings to
  // delimit the two cards, optional "| bad" / "| good" tone.
  //   ## COMPARE 従来 vs AI化後
  //   ### 従来 | bad
  //   - UI クレーム
  //   ### AI化後 | good
  //   - AI で網羅
  //   > 矢印: AI 化
  const compareMatch = title.match(/^COMPARE(?:\s+(.+))?$/);
  if (compareMatch) {
    const compareTitle = compareMatch[1]?.trim() || "比較";
    return parseCompare(compareTitle, lines);
  }

  // LAYERED: stacked layers. Body uses bullet lines "見出し | 詳細".
  //   ## LAYERED アーキテクチャ
  //   - Frontend | React + Tailwind
  //   - API | FastAPI
  //   - DB | PostgreSQL
  const layeredMatch = title.match(/^LAYERED(?:\s+(.+))?$/);
  if (layeredMatch) {
    const layeredTitle = layeredMatch[1]?.trim() || "階層構造";
    const layerLines = lines
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, ""));
    if (layerLines.length >= 2) {
      const layers = layerLines.slice(0, 5).map((line) => {
        const [heading, ...rest] = line.split("|").map((s) => s.trim());
        return { heading, detail: rest.length ? rest.join(" / ") : undefined };
      });
      return { kind: "layered", title: layeredTitle, layers };
    }
  }

  // PROGRESS: percent + state cards. Format:
  //   ## PROGRESS 50 開発進捗   (or "PROGRESS 50%: 開発進捗")
  //   - Phase 1 認証 | done
  //   - Phase 5 ナレッジ | next | 来月着手
  //   - Phase 6 レポート | todo
  // Allows optional "%" after the number and an optional ":/：" separator.
  const progressMatch = title.match(/^PROGRESS(?:\s+(\d{1,3})%?)?\s*[:：]?\s*(.*)$/);
  if (progressMatch && /^PROGRESS/.test(title)) {
    const percent = parseInt(progressMatch[1] || "0", 10);
    const progressTitle = progressMatch[2]?.trim() || "進捗状況";
    const itemLines = lines
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, ""));
    if (itemLines.length >= 1) {
      const items = itemLines.slice(0, 8).map((line) => {
        const parts = line.split("|").map((s) => s.trim());
        const label = parts[0];
        const stateRaw = (parts[1] || "todo").toLowerCase();
        const state: "done" | "next" | "todo" =
          stateRaw === "done" || stateRaw === "完了" || stateRaw === "✅"
            ? "done"
            : stateRaw === "next" ||
                stateRaw === "進行中" ||
                stateRaw === "着手予定" ||
                stateRaw === "▶"
              ? "next"
              : "todo";
        const note = parts[2];
        return { label, state, note };
      });
      return { kind: "progress", title: progressTitle, percent, items };
    }
  }

  // CHART: native bar/line/pie/doughnut. Body is a markdown table
  // where the first column is x-axis labels and remaining columns
  // are series.
  //   ## CHART bar 売上推移
  //   | 四半期 | 2024 | 2025 |
  //   |---|---|---|
  //   | Q1 | 100 | 150 |
  const chartMatch = title.match(/^CHART\s+(bar|line|pie|doughnut)(?:\s+(.+))?$/i);
  if (chartMatch) {
    const chartType = chartMatch[1].toLowerCase() as
      | "bar"
      | "line"
      | "pie"
      | "doughnut";
    const chartTitle = chartMatch[2]?.trim() || "Chart";
    const tableLines = lines.filter((l) => l.trim().startsWith("|"));
    if (tableLines.length >= 2) {
      const rows = tableLines
        .map((l) => l.trim())
        .filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
        .map((l) =>
          l
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim()),
        );
      if (rows.length >= 2 && rows[0].length >= 2) {
        const [header, ...body] = rows;
        const labels = body.map((r) => r[0]).filter((l) => l && l.length > 0);
        let series = header.slice(1).map((seriesName, i) => ({
          name: seriesName,
          values: body.map((r) => {
            const cell = r[i + 1];
            if (!cell) return 0;
            const n = parseFloat(cell.replace(/[^\d.\-]/g, ""));
            return Number.isFinite(n) ? n : 0;
          }),
        }));
        // pie / doughnut accept only one series — drop the rest if the
        // table accidentally has more.
        if (chartType === "pie" || chartType === "doughnut") {
          series = series.slice(0, 1);
        }
        // Validate: at least 1 label and 1 series with at least 1 value.
        if (
          labels.length >= 1 &&
          series.length >= 1 &&
          series[0].values.some((v) => v !== 0)
        ) {
          return { kind: "chart", title: chartTitle, chartType, labels, series };
        }
        // Fall through to table rendering if the chart data is unusable.
      }
    }
    // CHART recognized but data invalid — fall back to table from the
    // same markdown table lines.
    if (tableLines.length >= 2) return parseTable(chartTitle, tableLines);
  }

  // MOCKUP: browser / pdf / phone window. Body lines render inside
  // the mockup viewport. Optional "> URL: ..." sets the chrome label.
  //   ## MOCKUP browser AIレビュー画面
  //   > URL: https://review.example.com
  //   - 工程選択: UI / SS
  //   - ファイル D&D
  //   - ▶ 実行ボタン
  const mockupMatch = title.match(/^MOCKUP\s+(browser|pdf|phone)(?:\s+(.+))?$/i);
  if (mockupMatch) {
    const mockupType = mockupMatch[1].toLowerCase() as "browser" | "pdf" | "phone";
    const mockupTitle = mockupMatch[2]?.trim() || "Screen";
    let url: string | undefined;
    const bodyLines: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const urlMatch = line.match(/^>\s*(?:URL|url|アドレス)\s*[:：]\s*(.+)$/);
      if (urlMatch) {
        url = urlMatch[1].trim();
        continue;
      }
      if (line.startsWith(">")) continue;
      bodyLines.push(line.replace(/^[-*]\s+/, ""));
    }
    return { kind: "mockup", title: mockupTitle, mockupType, url, bodyLines };
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

function parseCompare(title: string, lines: string[]): Slide {
  let leftHeading = "Before";
  let rightHeading = "After";
  let leftTone: "bad" | undefined;
  let rightTone: "good" | undefined;
  const leftItems: string[] = [];
  const rightItems: string[] = [];
  let arrowLabel: string | undefined;
  let current: "left" | "right" | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const arrowMatch = line.match(/^>\s*(?:矢印|arrow)\s*[:：]\s*(.+)$/i);
    if (arrowMatch) {
      arrowLabel = arrowMatch[1].trim();
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      const [heading, ...toneParts] = h3[1].split("|").map((p) => p.trim());
      const tone = toneParts.join(" ").toLowerCase();
      if (current === null || current === "left") {
        if (current === null) {
          current = "left";
          leftHeading = heading;
          if (tone === "bad" || tone === "悪" || tone === "✕") leftTone = "bad";
        } else {
          current = "right";
          rightHeading = heading;
          if (tone === "good" || tone === "良" || tone === "✓") rightTone = "good";
        }
      }
      continue;
    }
    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch && current) {
      const text = itemMatch[1].trim();
      if (current === "left") leftItems.push(text);
      else rightItems.push(text);
    }
  }

  // Fallback: if the LLM forgot the ### subheadings, both columns end
  // up empty. Render as bullets so the user gets *something* readable
  // rather than two empty cards.
  if (leftItems.length === 0 && rightItems.length === 0) {
    const items = lines
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, ""));
    if (items.length > 0) {
      return { kind: "bullets", title, items };
    }
  }

  return {
    kind: "compare",
    title,
    left: { heading: leftHeading, items: leftItems, tone: leftTone },
    right: { heading: rightHeading, items: rightItems, tone: rightTone },
    arrowLabel,
  };
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
