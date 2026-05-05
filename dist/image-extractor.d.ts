import type { MhtmlDocument } from "./mhtml-parser.js";
export interface ExtractedImage {
    readonly data: Buffer;
    readonly filename: string;
    readonly contentType: string;
    readonly index: number;
}
export declare function extractImages(doc: MhtmlDocument): readonly ExtractedImage[];
