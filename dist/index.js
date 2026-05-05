#!/usr/bin/env node
import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Command } from "commander";
import { convertMhtmlToCbz } from "./convert.js";
const GLOB_CHARS = /[.+^${}()|[\]\\]/g;
function globToRegex(pattern) {
    const escaped = pattern.replaceAll(GLOB_CHARS, String.raw `\$&`);
    return new RegExp(`^${escaped.replaceAll("*", ".*")}$`);
}
async function listMhtmlInDir(dirPath) {
    const entries = await readdir(dirPath);
    return entries
        .filter((e) => e.toLowerCase().endsWith(".mhtml"))
        .map((e) => join(dirPath, e));
}
async function resolvePathOrDir(pattern) {
    if (pattern.includes("*")) {
        const dir = resolve(".");
        const entries = await readdir(dir);
        const re = globToRegex(pattern);
        return entries.filter((e) => re.test(e)).map((e) => resolve(dir, e));
    }
    const absPath = resolve(pattern);
    try {
        const s = await stat(absPath);
        if (s.isDirectory())
            return listMhtmlInDir(absPath);
    }
    catch {
        // 路径不存在，当作文件路径直接返回（后续 convert 会报错）
    }
    return [absPath];
}
async function expandMhtmlFiles(patterns) {
    const results = await Promise.all(patterns.map(resolvePathOrDir));
    return results.flat();
}
async function moveFiles(files, moveDir) {
    console.log(`\n移动已转换文件到: ${moveDir}`);
    for (const file of files) {
        const name = basename(file);
        const dest = join(moveDir, name);
        try {
            await rename(file, dest);
            console.log(`  ✓ ${name}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  ✗ 移动失败 ${name}: ${msg}`);
        }
    }
}
const program = new Command();
program
    .name("mhtml2cbz")
    .description("将 MHTML 文件转换为 CBZ 漫画档案格式")
    .version("1.0.3", "-v, --version")
    .argument("[input...]", "MHTML 文件路径，默认当前目录 *.mhtml")
    .requiredOption("-o, --output <dir>", "输出目录")
    .option("-m, --move <dir>", "转换成功后将原 MHTML 文件移动到指定目录")
    .option("-r, --rename <pattern>", "移除文件名中的指定字符串（可多次使用）", (value, prev) => [...prev, value], [])
    .action(async (inputs, options) => {
    const outputDir = resolve(options.output);
    const moveDir = options.move ? resolve(options.move) : null;
    const renamePatterns = options.rename;
    const patterns = inputs.length > 0 ? inputs : ["*.mhtml"];
    const files = await expandMhtmlFiles(patterns);
    if (files.length === 0) {
        console.error("错误: 当前目录下未找到 .mhtml 文件");
        console.error("提示: 请指定文件路径，或在包含 .mhtml 文件的目录下运行");
        process.exit(1);
    }
    console.log(`找到 ${files.length} 个文件待转换\n`);
    if (moveDir)
        await mkdir(moveDir, { recursive: true });
    const succeeded = [];
    let success = 0;
    let failed = 0;
    const total = files.length;
    for (let i = 0; i < total; i++) {
        const name = basename(files[i]);
        try {
            console.log(`[${i + 1}/${total}] 转换: ${name} ...`);
            const outputPath = await convertMhtmlToCbz(files[i], { outputDir, renamePatterns });
            console.log(`  ✓ -> ${outputPath}`);
            succeeded.push(files[i]);
            success++;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  ✗ ${name}: ${msg}`);
            failed++;
        }
    }
    if (moveDir && succeeded.length > 0) {
        await moveFiles(succeeded, moveDir);
    }
    console.log(`\n完成：${success} 成功，${failed} 失败`);
    if (failed > 0)
        process.exit(1);
});
program.parse();
//# sourceMappingURL=index.js.map