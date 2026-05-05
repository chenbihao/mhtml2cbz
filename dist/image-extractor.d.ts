import type { MhtmlDocument } from "./mhtml-parser.js";
export interface ExtractedImage {
    readonly data: Buffer;
    readonly filename: string;
    readonly contentType: string;
    readonly index: number;
}
export interface ExtractOptions {
    readonly downloadMissing?: boolean;
    readonly timeout?: number;
    readonly proxyUrl?: string;
}
export declare function extractImages(doc: MhtmlDocument, options?: ExtractOptions): Promise<readonly ExtractedImage[]>;
