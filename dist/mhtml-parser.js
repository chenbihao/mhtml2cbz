import { readFile } from "node:fs/promises";
const CRLF = "\r\n";
const LF = "\n";
function normalizeLineEndings(text) {
    return text.replace(/\r\n/g, LF);
}
function extractBoundary(contentType) {
    const match = contentType.match(/boundary="?([^"\s;]+)"?/);
    return match ? match[1] : null;
}
function parseHeaders(headerBlock) {
    const headers = {};
    const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
    for (const line of unfolded.split(LF)) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1)
            continue;
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();
        headers[key] = value;
    }
    return headers;
}
function decodeQuotedPrintable(text) {
    return text
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
function decodeBase64(text) {
    const cleaned = text.replace(/\s/g, "");
    return Buffer.from(cleaned, "base64");
}
function decodeBody(body, encoding) {
    const enc = encoding.toLowerCase().trim();
    if (enc === "base64") {
        return decodeBase64(body);
    }
    if (enc === "quoted-printable") {
        return decodeQuotedPrintable(body);
    }
    return body;
}
export async function parseMhtml(filePath) {
    let raw;
    try {
        raw = await readFile(filePath, "utf-8");
    }
    catch (err) {
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
        throw new Error(`不是有效的 MHTML 文件: Content-Type 头中未找到 boundary 定义 (实际 Content-Type: "${contentType}")`);
    }
    const bodyText = text.slice(headerEnd + 2);
    const boundaryLine = `--${boundary}`;
    const parts = [];
    const sections = bodyText.split(boundaryLine);
    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed || trimmed === "--")
            continue;
        const partHeaderEnd = trimmed.indexOf(LF + LF);
        if (partHeaderEnd === -1)
            continue;
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
        });
    }
    return { parts };
}
export function getHtmlPart(doc) {
    return doc.parts.find((p) => p.contentType.startsWith("text/html"));
}
export function getImageParts(doc) {
    return doc.parts.filter((p) => p.contentType.startsWith("image/") &&
        typeof p.rawBody !== "string");
}
export function getImageByContentId(doc, contentId) {
    return doc.parts.find((p) => p.contentId === contentId &&
        typeof p.rawBody !== "string");
}
//# sourceMappingURL=mhtml-parser.js.map