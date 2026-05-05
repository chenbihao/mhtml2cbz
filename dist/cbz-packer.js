import JSZip from "jszip";
import { writeFile } from "node:fs/promises";
export async function createCbz(images, outputPath) {
    if (images.length === 0) {
        throw new Error("图片列表为空，无法生成 CBZ 文件");
    }
    const zip = new JSZip();
    for (const img of images) {
        zip.file(img.filename, img.data);
    }
    let buffer;
    try {
        buffer = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
        });
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`压缩打包失败: ${reason}`);
    }
    try {
        await writeFile(outputPath, buffer);
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`写入文件失败: ${outputPath} — ${reason}`);
    }
}
//# sourceMappingURL=cbz-packer.js.map