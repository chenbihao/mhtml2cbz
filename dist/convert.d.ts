export interface ConvertOptions {
    readonly outputDir: string;
    readonly renamePatterns?: readonly string[];
}
export declare function convertMhtmlToCbz(inputPath: string, options: ConvertOptions): Promise<string>;
