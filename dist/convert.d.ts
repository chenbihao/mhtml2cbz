export interface ConvertOptions {
    readonly outputDir: string;
}
export declare function convertMhtmlToCbz(inputPath: string, options: ConvertOptions): Promise<string>;
