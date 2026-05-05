#!/usr/bin/env node

import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Command } from "commander";
import { convertMhtmlToCbz } from "./convert.js";
import { createLogger, resolveLogPath, nullLogger, type Logger } from "./logger.js";

const GLOB_CHARS = /[.+^${}()|[\]\\]/g;

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replaceAll(GLOB_CHARS, String.raw`\$&`);
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`);
}

async function listMhtmlInDir(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath);
  return entries
    .filter((e) => e.toLowerCase().endsWith(".mhtml"))
    .map((e) => join(dirPath, e));
}

async function resolvePathOrDir(pattern: string): Promise<string[]> {
  if (pattern.includes("*")) {
    const dir = resolve(".");
    const entries = await readdir(dir);
    const re = globToRegex(pattern);
    return entries.filter((e) => re.test(e)).map((e) => resolve(dir, e));
  }
  const absPath = resolve(pattern);
  try {
    const s = await stat(absPath);
    if (s.isDirectory()) return listMhtmlInDir(absPath);
  } catch {
    // 路径不存在，当作文件路径直接返回（后续 convert 会报错）
  }
  return [absPath];
}

async function expandMhtmlFiles(patterns: readonly string[]): Promise<string[]> {
  const results = await Promise.all(patterns.map(resolvePathOrDir));
  return results.flat();
}

async function moveFiles(files: readonly string[], moveDir: string, logger: Logger): Promise<void> {
  await logger.info(`\n移动已转换文件到: ${moveDir}`);
  for (const file of files) {
    const name = basename(file);
    const dest = join(moveDir, name);
    try {
      await rename(file, dest);
      await logger.info(`  ✓ ${name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logger.error(`  ✗ 移动失败 ${name}: ${msg}`);
    }
  }
}

const program = new Command();

program
  .name("mhtml2cbz")
  .description("将 MHTML 文件转换为 CBZ 漫画档案格式")
  .version("2.0.0", "-v, --version")
  .argument("[input...]", "MHTML 文件路径，默认当前目录 *.mhtml")
  .requiredOption("-o, --output <dir>", "输出目录")
  .option("-m, --move <dir>", "转换成功后将原 MHTML 文件移动到指定目录")
  .option("-r, --rename <pattern>", "移除文件名中的指定字符串（可多次使用）", (value, prev: string[]) => [...prev, value], [] as string[])
  .option("-l, --log [path]", "启用日志记录。可选参数：留空=当前目录+时间命名；目录/=指定目录+时间命名；完整路径=使用指定文件")
  .option("-d, --download-missing [proxy]", "当图片缺失时自动从 URL 下载补全，可指定代理URL（如 127.0.0.1:7890）")
  .option("--timeout <ms>", "下载超时时间（毫秒），默认 30000", (value) => Number.parseInt(value, 10), 30000)
  .action(async (inputs: string[], options: { output: string; move?: string; rename: string[]; log?: string | true; downloadMissing?: boolean | string; timeout: number }) => {
    const outputDir = resolve(options.output);
    const moveDir = options.move ? resolve(options.move) : null;
    const renamePatterns = options.rename;
    const downloadMissing = options.downloadMissing !== undefined;
    const proxyUrl = typeof options.downloadMissing === 'string' && options.downloadMissing
      ? (options.downloadMissing.includes('://') ? options.downloadMissing : `http://${options.downloadMissing}`)
      : undefined;
    const downloadTimeout = options.timeout;

    // 初始化日志记录器
    const logger: Logger = options.log !== undefined
      ? await createLogger(resolveLogPath(options.log === true ? undefined : options.log))
      : nullLogger;

    const patterns = inputs.length > 0 ? inputs : ["*.mhtml"];
    const files = await expandMhtmlFiles(patterns);

    if (files.length === 0) {
      await logger.error("错误: 当前目录下未找到 .mhtml 文件");
      await logger.error("提示: 请指定文件路径，或在包含 .mhtml 文件的目录下运行");
      await logger.close();
      process.exit(1);
    }

    await logger.info(`找到 ${files.length} 个文件待转换\n`);

    if (moveDir) await mkdir(moveDir, { recursive: true });

    const succeeded: string[] = [];
    let success = 0;
    let failed = 0;

    const total = files.length;
    for (let i = 0; i < total; i++) {
      const name = basename(files[i]);
      try {
        await logger.info(`[${i + 1}/${total}] 转换: ${name} ...`);
        const outputPath = await convertMhtmlToCbz(files[i], { outputDir, renamePatterns, logger, downloadMissing, downloadTimeout, proxyUrl });
        await logger.info(`  ✓ -> ${outputPath}`);
        succeeded.push(files[i]);
        success++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logger.error(`  ✗ ${name}: ${msg}`);
        failed++;
      }
    }

    if (moveDir && succeeded.length > 0) {
      await moveFiles(succeeded, moveDir, logger);
    }

    await logger.info(`\n完成：${success} 成功，${failed} 失败`);
    await logger.close();
    if (failed > 0) process.exit(1);
  });

program.parse();
