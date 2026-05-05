import { getHtmlPart } from "./mhtml-parser.js";
import { ProxyAgent, fetch } from "undici";
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
/**
 * 延迟函数
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * 计算重试延迟（指数退避）
 */
function getRetryDelay(attempt, baseDelay = 1000) {
    // 指数退避：1s, 2s, 4s, 8s... 最大 10s
    return Math.min(baseDelay * Math.pow(2, attempt), 10000);
}
/**
 * 判断错误是否可重试
 */
function isRetryableError(error) {
    if (!(error instanceof Error))
        return true;
    const msg = error.message.toLowerCase();
    // 网络错误、超时、连接重置等通常是临时性的
    return (msg.includes("abort") ||
        msg.includes("timeout") ||
        msg.includes("fetch failed") ||
        msg.includes("econnreset") ||
        msg.includes("econnrefused") ||
        msg.includes("enotfound") ||
        msg.includes("socket hang up"));
}
async function downloadImage(url, timeout, proxyUrl, logger, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fetchOptions = { signal: controller.signal };
            if (proxyUrl) {
                fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
            }
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);
            if (!response.ok) {
                // HTTP 错误状态码，通常不需要重试（除非是 5xx）
                if (response.status >= 500 && attempt < retries) {
                    const retryMsg = `下载失败 "${url}"：HTTP ${response.status}，第 ${attempt + 1} 次重试...`;
                    if (logger)
                        await logger.info(retryMsg);
                    else
                        console.warn(retryMsg);
                    await delay(getRetryDelay(attempt));
                    continue;
                }
                const msg = `警告：下载失败 "${url}"：HTTP ${response.status}，跳过`;
                if (logger)
                    await logger.error(msg);
                else
                    console.warn(msg);
                return null;
            }
            const arrayBuffer = await response.arrayBuffer();
            const contentType = response.headers.get("content-type") ?? "image/jpeg";
            return {
                data: Buffer.from(arrayBuffer),
                contentType,
            };
        }
        catch (err) {
            clearTimeout(timeoutId);
            const msg = err instanceof Error ? err.message : String(err);
            // 判断是否可重试
            if (attempt < retries && isRetryableError(err)) {
                const retryMsg = `下载失败 "${url}"：${msg}，第 ${attempt + 1} 次重试...`;
                if (logger)
                    await logger.info(retryMsg);
                else
                    console.warn(retryMsg);
                await delay(getRetryDelay(attempt));
                continue;
            }
            const logMsg = `警告：下载失败 "${url}"：${msg}，跳过`;
            if (logger)
                await logger.error(logMsg);
            else
                console.warn(logMsg);
            return null;
        }
    }
    return null;
}
export async function extractImages(doc, options) {
    const htmlPart = getHtmlPart(doc);
    if (!htmlPart) {
        throw new Error("MHTML 文件中未找到 HTML 内容");
    }
    const html = htmlPart.body;
    const logger = options?.logger;
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
    const downloadMissing = options?.downloadMissing ?? false;
    const timeout = options?.timeout ?? 30000;
    const retries = options?.retries ?? 3;
    for (let i = 0; i < refs.values.length; i++) {
        const ref = refs.values[i];
        let imagePart = refs.type === "cid"
            ? getImagePartByCid(doc, ref)
            : getImagePartByUrl(doc, ref);
        // 如果未找到图片且启用下载，尝试从 URL 下载
        if (!imagePart && downloadMissing && refs.type === "url") {
            const warnMsg = `警告：未找到图片 "${ref}"，正在尝试下载...`;
            if (logger)
                await logger.info(warnMsg);
            else
                console.warn(warnMsg);
            const downloaded = await downloadImage(ref, timeout, options?.proxyUrl, logger, retries);
            if (downloaded) {
                const successMsg = `已下载：${ref}`;
                if (logger)
                    await logger.info(successMsg);
                else
                    console.warn(successMsg);
                imagePart = {
                    headers: {},
                    body: "",
                    rawBody: downloaded.data,
                    contentType: downloaded.contentType,
                    contentId: "",
                    contentLocation: ref,
                    contentTransferEncoding: "binary",
                };
            }
        }
        if (!imagePart) {
            const warnMsg = `警告：未找到图片 "${ref}"，跳过`;
            if (logger)
                await logger.error(warnMsg);
            else
                console.warn(warnMsg);
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