# mhtml2cbz

将 MHTML 网页存档文件转换为 CBZ 漫画档案格式的命令行工具。

从 MHTML 中提取所有图片，按页面中的显示顺序排列，打包为标准的 CBZ 文件，可直接在漫画阅读器中打开。

## 功能

- 自动解析 MHTML 中的 MIME 多部分结构
- 按 HTML 中 `<img>` 标签的出现顺序排列图片
- 支持 `cid:` 和 URL 两种图片引用方式
- 保留原始图片格式（webp、png、jpg 等）
- 支持传入文件夹路径，自动扫描其下所有 `.mhtml` 文件
- 支持单文件和批量转换
- 转换完成后可自动将原文件移动到指定目录

## 安装

### 直接使用（无需克隆仓库）

```bash
npx github:chenbihao/mhtml2cbz -o ./输出目录
```

### 全局安装

```bash
# 从 GitHub 安装
npm install -g github:chenbihao/mhtml2cbz

# 或克隆后本地安装
git clone https://github.com/chenbihao/mhtml2cbz.git
cd mhtml2cbz
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
```

### 参数

| 参数 | 说明 |
|------|------|
| `[input...]` | MHTML 文件或文件夹路径。默认当前目录下所有 `.mhtml` 文件 |
| `-o, --output <dir>` | **（必填）** 输出目录 |
| `-m, --move <dir>` | 转换成功后将原 MHTML 文件移动到指定目录 |
| `-v, --version` | 显示版本号 |
| `-h, --help` | 显示帮助信息 |

## 项目结构

```
src/
├── index.ts           # CLI 入口
├── convert.ts         # 转换编排逻辑
├── mhtml-parser.ts    # MHTML MIME 解析器
├── image-extractor.ts # 图片提取与排序
└── cbz-packer.ts      # CBZ/ZIP 打包
```

## 技术栈

- TypeScript + Node.js (ESM)
- [commander](https://github.com/tj/commander.js) — CLI 框架
- [JSZip](https://github.com/Stuk/jszip) — ZIP 打包

## License

MIT
