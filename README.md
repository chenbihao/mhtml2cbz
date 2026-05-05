# mhtml2cbz

将 MHTML 网页存档文件转换为 CBZ 漫画档案格式的命令行工具。

从 MHTML 中提取所有图片，按页面中的显示顺序排列，打包为标准的 CBZ 文件，可直接在漫画阅读器中打开。

## 功能

- 保留原始图片格式（webp、png、jpg 等）
- 支持传入文件夹路径，自动扫描其下所有 `.mhtml` 文件
- 支持文件名清理，移除指定字符串
- 支持单文件和批量转换
- 转换完成后可自动将原文件移动到指定目录
- 支持日志记录功能，便于追踪转换过程
- 支持缺失图片自动从 URL 下载补全

## 安装

### 直接使用（无需克隆仓库）

```bash
npx github:chenbihao/mhtml2cbz -o ./输出目录
```

### 全局安装

```bash
# npm安装
npm install -g mhtml2cbz
# 验证：
mhtml2cbz -h

# 克隆后本地安装
git clone https://github.com/chenbihao/mhtml2cbz.git
cd mhtml2cbz
npm run build
npm install -g .
```

卸载：

```bash
npm uninstall -g mhtml2cbz
```

### 开发使用

```bash
git clone https://github.com/chenbihao/mhtml2cbz.git
cd mhtml2cbz
npm install
npx tsx src/index.ts 文件.mhtml -o 输出目录
```

### 参数

| 参数 | 说明 |
|------|------|
| `[input...]` | MHTML 文件或文件夹路径。默认当前目录下所有 `.mhtml` 文件 |
| `-o, --output <dir>` | **（必填）** 输出目录 |
| `-m, --move <dir>` | 转换成功后将原 MHTML 文件移动到指定目录 |
| `-r, --rename <pattern>` | 移除文件名中的指定字符串（可多次使用，自动去除首尾空格） |
| `-d, --download-missing [proxy]` | 当图片缺失时自动从 URL 下载补全，可选代理URL（如 `127.0.0.1:7890`） |
| `--timeout <ms>` | 下载超时时间（毫秒），默认 30000 |
| `--retries <n>` | 下载失败重试次数，默认 3 |
| `-l, --log [path]` | 启用日志记录。可选参数：留空=当前目录+时间命名；`目录/`=指定目录+时间命名；完整路径=使用指定文件名 |
| `-v, --version` | 显示版本号 |
| `-h, --help` | 显示帮助信息 |


## 使用

```bash
# 转换当前目录下所有 .mhtml 文件
mhtml2cbz -o ./输出目录

# 转换单个文件
mhtml2cbz 漫画.mhtml -o ./输出目录

# 传入文件夹，自动扫描其下所有 .mhtml
mhtml2cbz ./漫画文件夹 -o ./输出目录

# 批量转换（通配符）
mhtml2cbz "*.mhtml" -o ./输出目录

# 转换后移动原文件到指定目录
mhtml2cbz -o ./cbz输出 -m ./已转换

# 启用日志记录（日志文件保存在当前目录，以时间命名）
mhtml2cbz -o ./输出目录 -l

# 指定日志目录（日志文件保存在指定目录，以时间命名）
mhtml2cbz -o ./输出目录 -l ./logs/

# 指定日志文件完整路径
mhtml2cbz -o ./输出目录 -l ./logs/convert.log

# 清理文件名（移除指定字符串）
mhtml2cbz *.mhtml -o ./output -r "［XX漫画组］" -r "（高清）"

# 启用缺失图片自动下载（当 MHTML 中部分图片未嵌入时）
mhtml2cbz 漫画.mhtml -o ./output -d

# 使用代理下载缺失图片
mhtml2cbz 漫画.mhtml -o ./output -d 127.0.0.1:7890

# 使用完整代理 URL
mhtml2cbz 漫画.mhtml -o ./output -d http://127.0.0.1:7890

# 自定义下载超时时间（默认 30 秒）
mhtml2cbz 漫画.mhtml -o ./output -d --timeout 60000

# 自定义下载重试次数（默认 3 次）
mhtml2cbz 漫画.mhtml -o ./output -d --retries 5

# 完整示例：代理 + 超时 + 重试
mhtml2cbz 漫画.mhtml -o ./output -d 127.0.0.1:7890 --timeout 60000 --retries 5
```

## 项目结构

```
src/
├── index.ts           # CLI 入口
├── convert.ts         # 转换编排逻辑
├── mhtml-parser.ts    # MHTML MIME 解析器
├── image-extractor.ts # 图片提取与排序
├── cbz-packer.ts      # CBZ/ZIP 打包
└── logger.ts          # 日志记录模块
```

## 技术栈

- TypeScript + Node.js (ESM)
- [commander](https://github.com/tj/commander.js) — CLI 框架
- [JSZip](https://github.com/Stuk/jszip) — ZIP 打包
- [undici](https://github.com/nodejs/undici) — HTTP 客户端（支持代理、自动重试）

## License

MIT
