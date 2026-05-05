export interface Logger {
    info(message: string): Promise<void>;
    error(message: string): Promise<void>;
    close(): Promise<void>;
}
/**
 * 解析日志路径参数
 * @param logPath 日志路径参数
 * - 不提供或空字符串: 当前目录，以启动时间命名
 * - 以路径分隔符结尾 (如 "logs/"): 指定目录，以启动时间命名
 * - 完整文件路径 (如 "logs/app.log"): 使用指定路径
 * @returns 完整的日志文件路径
 */
export declare function resolveLogPath(logPath: string | undefined): string;
/**
 * 创建日志记录器
 * @param logFilePath 日志文件的完整路径
 */
export declare function createLogger(logFilePath: string): Promise<Logger>;
/**
 * 空日志记录器（不记录日志）
 */
export declare const nullLogger: Logger;
