import type { ImageSlide } from "../types";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"] as const;
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_IMAGE_FILES = 12;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 32_000_000;
const MAX_OUTPUT_EDGE = 1920;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF87A = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

export const ACCEPTED_TEXT_AND_IMAGE_FILES =
  ".md,.markdown,.txt,text/markdown,text/plain,.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif";

export function isTextFile(file: File): boolean {
  return /\.(md|markdown|txt)$/i.test(file.name) ||
    file.type === "text/markdown" ||
    file.type === "text/plain";
}

export function isSupportedImageFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
    IMAGE_MIME_TYPES.has(file.type);
}

export async function filesToImageSlides(files: File[]): Promise<ImageSlide[]> {
  if (files.length > MAX_IMAGE_FILES) {
    throw new Error(`画像は一度に ${MAX_IMAGE_FILES} 枚まで投入できます`);
  }
  return Promise.all(files.map((file, i) => fileToImageSlide(file, i + 1)));
}

export function imageSlidesToMarkdown(slides: ImageSlide[]): string {
  return slides
    .map((slide) => {
      const caption = slide.caption ? `\n> ${slide.caption}` : "";
      return `## ${slide.title}${caption}\n![${slide.alt}](添付画像: ${slide.width}x${slide.height})`;
    })
    .join("\n\n");
}

async function fileToImageSlide(file: File, index: number): Promise<ImageSlide> {
  validateFileShell(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateSignature(file, bytes);
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: file.type }));
  try {
    const img = await decodeImage(objectUrl);
    validateDimensions(file, img.naturalWidth, img.naturalHeight);
    const normalized = normalizeImageToPng(img);
    const title = titleFromFilename(file.name) || `画像 ${index}`;
    return {
      kind: "image",
      title,
      dataUrl: normalized.dataUrl,
      alt: title,
      caption: file.name,
      width: normalized.width,
      height: normalized.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function validateFileShell(file: File) {
  if (!isSupportedImageFile(file)) {
    throw new Error(
      `${file.name}: 対応画像は PNG / JPEG / WebP / GIF のみです。SVG は安全のため未対応です。`,
    );
  }
  if (file.size <= 0) {
    throw new Error(`${file.name}: 空の画像ファイルです`);
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`${file.name}: 画像は 1 枚 ${MAX_INPUT_BYTES / 1024 / 1024}MB 以下にしてください`);
  }
}

function validateSignature(file: File, bytes: Uint8Array) {
  const type = sniffImageType(bytes);
  if (!type) {
    throw new Error(`${file.name}: 画像ファイルとして読み取れませんでした`);
  }
  if (file.type && !IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error(`${file.name}: MIMEタイプ ${file.type} は未対応です`);
  }
}

function sniffImageType(bytes: Uint8Array): "png" | "jpeg" | "webp" | "gif" | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "jpeg";
  if (startsWith(bytes, GIF87A) || startsWith(bytes, GIF89A)) return "gif";
  if (
    bytes.length >= 12 &&
    bytesToAscii(bytes, 0, 4) === "RIFF" &&
    bytesToAscii(bytes, 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像をデコードできませんでした"));
    img.src = src;
  });
}

function validateDimensions(file: File, width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`${file.name}: 画像サイズを取得できませんでした`);
  }
  if (width * height > MAX_SOURCE_PIXELS) {
    throw new Error(`${file.name}: 画像のピクセル数が大きすぎます`);
  }
}

function normalizeImageToPng(img: HTMLImageElement): {
  dataUrl: string;
  width: number;
  height: number;
} {
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像変換に失敗しました");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width,
    height,
  };
}

function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

function bytesToAscii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
