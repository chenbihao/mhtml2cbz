import type { Logger } from "./logger.js";
export interface ConvertOptions {
    readonly outputDir: string;
    readonly renamePatterns?: readonly string[];
    readonly logger?: Logger;
}
export declare function convertMhtmlToCbz(inputPath: string, options: ConvertOptions): Promise<string>;
