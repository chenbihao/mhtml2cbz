import type { MhtmlDocument, MhtmlPart } from "./mhtml-parser.js";
import { getHtmlPart } from "./mhtml-parser.js";
import { ProxyAgent, fetch } from "undici";

export interface ExtractedImage {
  readonly data: Buffer;
  readonly filename: string;
  readonly contentType: string;
  readonly index: number;
}

export interface ExtractOptions {
  readonly downloadMissing?: boolean;
  readonly timeout?: number;
  readonly proxyUrl?: string;
}

const IMG_CID_RE = /<img[^>]+src\s*=\s*["']cid:([^"']+)["'][^>]*>/gi;
const IMG_URL_RE = /<img[^>]+src\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>/gi;

const EXTENSION_MAP: Record<string, string> = {
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

const URL_EXTENSION_MAP: Record<string, string> = {
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

function getMimeType(contentType: string): string {
  const idx = contentType.indexOf(";");
  return idx === -1 ? contentType.trim().toLowerCase() : contentType.slice(0, idx).trim().toLowerCase();
}

function getExtensionFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
    return URL_EXTENSION_MAP[ext] ?? ".bin";
  } catch {
    return ".bin";
  }
}

function padNumber(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function extractCidOrder(html: string): readonly string[] {
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = IMG_CID_RE.exec(html)) !== null) {
    const cid = match[1];
    if (cid && !ids.includes(cid)) {
      ids.push(cid);
    }
  }
  return ids;
}

function extractUrlOrder(html: string): readonly string[] {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = IMG_URL_RE.exec(html)) !== null) {
    const url = match[1];
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

function getImagePartByCid(
  doc: MhtmlDocument,
  cid: string
): (MhtmlPart & { rawBody: Buffer }) | undefined {
  return doc.parts.find(
    (p): p is MhtmlPart & { rawBody: Buffer } =>
      p.contentId === cid && typeof (p as any).rawBody !== "string"
  );
}

function getImagePartByUrl(
  doc: MhtmlDocument,
  url: string
): (MhtmlPart & { rawBody: Buffer }) | undefined {
  return doc.parts.find(
    (p): p is MhtmlPart & { rawBody: Buffer } =>
      p.contentLocation === url && typeof (p as any).rawBody !== "string"
  );
}

async function downloadImage(
  url: string,
  timeout: number,
  proxyUrl?: string
): Promise<{ data: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchOptions: any = { signal: controller.signal };

    if (proxyUrl) {
      fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
    }

    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      console.warn(`警告：下载失败 "${url}"：HTTP ${response.status}，跳过`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    clearTimeout(timeoutId);
    return {
      data: Buffer.from(arrayBuffer),
      contentType,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`警告：下载失败 "${url}"：${msg}，跳过`);
    return null;
  }
}

export async function extractImages(
  doc: MhtmlDocument,
  options?: ExtractOptions
): Promise<readonly ExtractedImage[]> {
  const htmlPart = getHtmlPart(doc);
  if (!htmlPart) {
    throw new Error("MHTML 文件中未找到 HTML 内容");
  }

  const html = htmlPart.body;

  // 优先尝试 cid: 引用方式，其次尝试 URL 引用方式
  const cidRefs = extractCidOrder(html);
  const urlRefs = cidRefs.length > 0 ? [] : extractUrlOrder(html);

  const refs =
    cidRefs.length > 0
      ? { type: "cid" as const, values: cidRefs }
      : { type: "url" as const, values: urlRefs };

  if (refs.values.length === 0) {
    throw new Error("HTML 中未找到图片引用（cid: 或 URL）");
  }

  const totalDigits = String(refs.values.length).length;
  const images: ExtractedImage[] = [];
  const downloadMissing = options?.downloadMissing ?? false;
  const timeout = options?.timeout ?? 30000;

  for (let i = 0; i < refs.values.length; i++) {
    const ref = refs.values[i];
    let imagePart:
      | (MhtmlPart & { rawBody: Buffer })
      | null
      | undefined =
      refs.type === "cid"
        ? getImagePartByCid(doc, ref)
        : getImagePartByUrl(doc, ref);

    // 如果未找到图片且启用下载，尝试从 URL 下载
    if (!imagePart && downloadMissing && refs.type === "url") {
      console.warn(`警告：未找到图片 "${ref}"，正在尝试下载...`);
      const downloaded = await downloadImage(ref, timeout, options?.proxyUrl);
      if (downloaded) {
        console.warn(`已下载：${ref}`);
        imagePart = {
          headers: {},
          body: "",
          rawBody: downloaded.data,
          contentType: downloaded.contentType,
          contentId: "",
          contentLocation: ref,
          contentTransferEncoding: "binary",
        } as MhtmlPart & { rawBody: Buffer };
      }
    }

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
