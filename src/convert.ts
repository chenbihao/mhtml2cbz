import { access, mkdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { parseMhtml } from "./mhtml-parser.js";
import { extractImages } from "./image-extractor.js";
import { createCbz } from "./cbz-packer.js";
import type { Logger } from "./logger.js";

export interface ConvertOptions {
  readonly outputDir: string;
  readonly renamePatterns?: readonly string[];
  readonly logger?: Logger;
  readonly downloadMissing?: boolean;
  readonly downloadTimeout?: number;
  readonly proxyUrl?: string;
  readonly downloadRetries?: number;
}

function cleanFileName(name: string, patterns: readonly string[]): string {
  let result = name;
  for (const pattern of patterns) {
    result = result.replaceAll(pattern, "");
  }
  return result.trim();
}

export async function convertMhtmlToCbz(
  inputPath: string,
  options: ConvertOptions
): Promise<string> {
  // 校验输入文件
  try {
    await access(inputPath);
  } catch {
    throw new Error(`输入文件不存在: ${inputPath}`);
  }

  const ext = extname(inputPath).toLowerCase();
  if (ext !== ".mhtml") {
    throw new Error(`不支持的文件格式 "${ext}"，仅支持 .mhtml 文件`);
  }

  const fileStat = await stat(inputPath);
  if (fileStat.size === 0) {
    throw new Error("文件为空，无法解析");
  }

  const mhtmlName = basename(inputPath, ".mhtml");
  const cleanedName = cleanFileName(mhtmlName, options.renamePatterns ?? []);
  const outputPath = join(options.outputDir, `${cleanedName}.cbz`);

  await mkdir(options.outputDir, { recursive: true });

  const doc = await parseMhtml(inputPath);
  const images = await extractImages(doc, {
    downloadMissing: options.downloadMissing,
    timeout: options.downloadTimeout,
    proxyUrl: options.proxyUrl,
    logger: options.logger,
    retries: options.downloadRetries,
  });

  if (images.length === 0) {
    throw new Error("文件中未提取到任何图片，可能不是有效的漫画页面");
  }

  await createCbz(images, outputPath);

  return outputPath;
}
