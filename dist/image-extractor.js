import { getHtmlPart } from "./mhtml-parser.js";
const IMG_CID_RE = /<img[^>]+src\s*=\s*["']cid:([^"']+)["'][^>]*>/gi;
const IMG_URL_RE = /<img[^>]+src\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>/gi;
const EXTENSION_MAP = {
    "image/webp": ".webp",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/jpg": ".jpg",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
    // 非标准但常见的类型
    "binary/octet-stream": "", // 需要从 URL 推断
    "application/octet-stream": "", // 需要从 URL 推断
};
const URL_EXTENSION_MAP = {
    ".webp": ".webp",
    ".png": ".png",
    ".jpg": ".jpg",
    ".jpeg": ".jpg",
    ".gif": ".gif",
    ".avif": ".avif",
    ".bmp": ".bmp",
    ".tiff": ".tiff",
    ".tif": ".tiff",
    ".svg": ".svg",
    ".ico": ".ico",
};
function getMimeType(contentType) {
    const idx = contentType.indexOf(";");
    return idx === -1 ? contentType.trim().toLowerCase() : contentType.slice(0, idx).trim().toLowerCase();
}
function getExtensionFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const ext = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
        return URL_EXTENSION_MAP[ext] ?? ".bin";
    }
    catch {
        return ".bin";
    }
}
function padNumber(n, width) {
    return String(n).padStart(width, "0");
}
function extractCidOrder(html) {
    const ids = [];
    let match;
    while ((match = IMG_CID_RE.exec(html)) !== null) {
        const cid = match[1];
        if (cid && !ids.includes(cid)) {
            ids.push(cid);
        }
    }
    return ids;
}
function extractUrlOrder(html) {
    const urls = [];
    let match;
    while ((match = IMG_URL_RE.exec(html)) !== null) {
        const url = match[1];
        if (url && !urls.includes(url)) {
            urls.push(url);
        }
    }
    return urls;
}
function getImagePartByCid(doc, cid) {
    return doc.parts.find((p) => p.contentId === cid && typeof p.rawBody !== "string");
}
function getImagePartByUrl(doc, url) {
    return doc.parts.find((p) => p.contentLocation === url && typeof p.rawBody !== "string");
}
export function extractImages(doc) {
    const htmlPart = getHtmlPart(doc);
    if (!htmlPart) {
        throw new Error("MHTML 文件中未找到 HTML 内容");
    }
    const html = htmlPart.body;
    // 优先尝试 cid: 引用方式，其次尝试 URL 引用方式
    const cidRefs = extractCidOrder(html);
    const urlRefs = cidRefs.length > 0 ? [] : extractUrlOrder(html);
    const refs = cidRefs.length > 0
        ? { type: "cid", values: cidRefs }
        : { type: "url", values: urlRefs };
    if (refs.values.length === 0) {
        throw new Error("HTML 中未找到图片引用（cid: 或 URL）");
    }
    const totalDigits = String(refs.values.length).length;
    const images = [];
    for (let i = 0; i < refs.values.length; i++) {
        const ref = refs.values[i];
        const imagePart = refs.type === "cid"
            ? getImagePartByCid(doc, ref)
            : getImagePartByUrl(doc, ref);
        if (!imagePart) {
            console.warn(`警告：未找到图片 "${ref}"，跳过`);
            continue;
        }
        const mimeType = getMimeType(imagePart.contentType);
        let ext = EXTENSION_MAP[mimeType] ?? ".bin";
        // 如果 Content-Type 是通用二进制类型，尝试从 URL 扩展名推断
        if (ext === "" && imagePart.contentLocation) {
            ext = getExtensionFromUrl(imagePart.contentLocation);
        }
        const filename = `${padNumber(images.length + 1, totalDigits)}${ext}`;
        images.push({
            data: imagePart.rawBody,
            filename,
            contentType: imagePart.contentType,
            index: i,
        });
    }
    return images;
}
//# sourceMappingURL=image-extractor.js.map