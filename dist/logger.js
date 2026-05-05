import { appendFile, mkdir } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
/**
 * 解析日志路径参数
 * @param logPath 日志路径参数
 * - 不提供或空字符串: 当前目录，以启动时间命名
 * - 以路径分隔符结尾 (如 "logs/"): 指定目录，以启动时间命名
 * - 完整文件路径 (如 "logs/app.log"): 使用指定路径
 * @returns 完整的日志文件路径
 */
export function resolveLogPath(logPath) {
    const defaultFileName = generateLogFileName();
    // 情况1: 未提供参数，使用当前目录 + 时间命名
    if (!logPath || logPath === "") {
        return resolve(`./${defaultFileName}.log`);
    }
    const absolutePath = resolve(logPath);
    // 情况2: 以路径分隔符结尾，视为目录
    if (logPath.endsWith("/") || logPath.endsWith("\\")) {
        return resolve(absolutePath, `${defaultFileName}.log`);
    }
    // 情况3: 路径已存在且是目录，使用目录 + 时间命名
    // 这里无法使用同步检查，改用扩展名判断
    // 情况4: 有 .log 扩展名，视为完整文件路径
    if (extname(absolutePath).toLowerCase() === ".log") {
        return absolutePath;
    }
    // 情况5: 其他情况，视为目录路径
    return resolve(absolutePath, `${defaultFileName}.log`);
}
/**
 * 创建日志记录器
 * @param logFilePath 日志文件的完整路径
 */
export async function createLogger(logFilePath) {
    const logDir = dirname(logFilePath);
    const logFileName = basename(logFilePath, ".log");
    // 确保日志目录存在
    await mkdir(logDir, { recursive: true });
    // 写入日志文件（同时输出到控制台）
    const writeLog = async (level, message) => {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        // 输出到控制台
        if (level === "ERROR") {
            console.error(message);
        }
        else {
            console.log(message);
        }
        // 写入文件
        await appendFile(logFilePath, logLine, "utf-8");
    };
    // 写入启动信息
    const startupMessage = `========== 日志开始: ${logFileName} ==========\n`;
    await appendFile(logFilePath, startupMessage, "utf-8");
    return {
        async info(message) {
            await writeLog("INFO", message);
        },
        async error(message) {
            await writeLog("ERROR", message);
        },
        async close() {
            const closeMessage = `========== 日志结束: ${logFileName} ==========\n`;
            await appendFile(logFilePath, closeMessage, "utf-8");
        },
    };
}
/**
 * 空日志记录器（不记录日志）
 */
export const nullLogger = {
    async info(_message) {
        // 仅输出到控制台
        console.log(_message);
    },
    async error(_message) {
        // 仅输出到控制台
        console.error(_message);
    },
    async close() {
        // 无操作
    },
};
/**
 * 生成基于当前时间的日志文件名（到秒）
 * 格式: YYYY-MM-DD_HH-mm-ss
 */
function generateLogFileName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const second = String(now.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
}
//# sourceMappingURL=logger.js.map