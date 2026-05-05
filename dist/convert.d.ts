import type { Logger } from "./logger.js";
export interface ConvertOptions {
    readonly outputDir: string;
    readonly renamePatterns?: readonly string[];
    readonly logger?: Logger;
    readonly downloadMissing?: boolean;
    readonly downloadTimeout?: number;
    readonly proxyUrl?: string;
}
export declare function convertMhtmlToCbz(inputPath: string, options: ConvertOptions): Promise<string>;
