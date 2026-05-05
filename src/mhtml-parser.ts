import { readFile } from "node:fs/promises";

export interface MhtmlPart {
  headers: Record<string, string>;
  body: string;
  contentType: string;
  contentId: string;
  contentLocation: string;
  contentTransferEncoding: string;
}

export interface MhtmlDocument {
  parts: readonly MhtmlPart[];
}

const CRLF = "\r\n";
const LF = "\n";

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, LF);
}

function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary="?([^"\s;]+)"?/);
  return match ? match[1] : null;
}

function parseHeaders(headerBlock: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(LF)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    headers[key] = value;
  }
  return headers;
}

function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function decodeBase64(text: string): Buffer {
  const cleaned = text.replace(/\s/g, "");
  return Buffer.from(cleaned, "base64");
}

function decodeBody(
  body: string,
  encoding: string
): string | Buffer {
  const enc = encoding.toLowerCase().trim();
  if (enc === "base64") {
    return decodeBase64(body);
  }
  if (enc === "quoted-printable") {
    return decodeQuotedPrintable(body);
  }
  return body;
}

export async function parseMhtml(filePath: string): Promise<MhtmlDocument> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`读取文件失败: ${reason}`);
  }

  if (!raw.trim()) {
    throw new Error("文件内容为空，不是有效的 MHTML 文件");
  }

  const text = normalizeLineEndings(raw);

  const headerEnd = text.indexOf(LF + LF);
  if (headerEnd === -1) {
    throw new Error("不是有效的 MHTML 文件: 缺少 MIME 头部结构");
  }

  const topHeaders = parseHeaders(text.slice(0, headerEnd));
  const contentType = topHeaders["content-type"] ?? "";
  const boundary = extractBoundary(contentType);
  if (!boundary) {
    throw new Error(
      `不是有效的 MHTML 文件: Content-Type 头中未找到 boundary 定义 (实际 Content-Type: "${contentType}")`
    );
  }

  const bodyText = text.slice(headerEnd + 2);
  const boundaryLine = `--${boundary}`;
  const parts: MhtmlPart[] = [];

  const sections = bodyText.split(boundaryLine);
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed === "--") continue;

    const partHeaderEnd = trimmed.indexOf(LF + LF);
    if (partHeaderEnd === -1) continue;

    const headerBlock = trimmed.slice(0, partHeaderEnd);
    const bodyContent = trimmed.slice(partHeaderEnd + 2);
    const headers = parseHeaders(headerBlock);
    const encoding = headers["content-transfer-encoding"] ?? "7bit";
    const decoded = decodeBody(bodyContent, encoding);

    parts.push({
      headers,
      body: typeof decoded === "string" ? decoded : "",
      rawBody: decoded,
      contentType: headers["content-type"] ?? "",
      contentId: (headers["content-id"] ?? "").replace(/[<>]/g, ""),
      contentLocation: headers["content-location"] ?? "",
      contentTransferEncoding: encoding,
    } as MhtmlPart & { rawBody: string | Buffer });
  }

  return { parts };
}

export function getHtmlPart(doc: MhtmlDocument): MhtmlPart | undefined {
  return doc.parts.find(
    (p) => p.contentType.startsWith("text/html")
  );
}

export function getImageParts(doc: MhtmlDocument): readonly (MhtmlPart & { rawBody: Buffer })[] {
  return doc.parts.filter(
    (p): p is MhtmlPart & { rawBody: Buffer } =>
      p.contentType.startsWith("image/") &&
      typeof (p as any).rawBody !== "string"
  );
}

export function getImageByContentId(
  doc: MhtmlDocument,
  contentId: string
): (MhtmlPart & { rawBody: Buffer }) | undefined {
  return doc.parts.find(
    (p): p is MhtmlPart & { rawBody: Buffer } =>
      p.contentId === contentId &&
      typeof (p as any).rawBody !== "string"
  );
}
