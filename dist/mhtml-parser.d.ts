export interface MhtmlPart {
    headers: Record<string, string>;
    body: string;
    contentType: string;
    contentId: string;
    contentLocation: string;
    contentTransferEncoding: string;
}
export interface MhtmlDocument {
    parts: readonly MhtmlPart[];
}
export declare function parseMhtml(filePath: string): Promise<MhtmlDocument>;
export declare function getHtmlPart(doc: MhtmlDocument): MhtmlPart | undefined;
export declare function getImageParts(doc: MhtmlDocument): readonly (MhtmlPart & {
    rawBody: Buffer;
})[];
export declare function getImageByContentId(doc: MhtmlDocument, contentId: string): (MhtmlPart & {
    rawBody: Buffer;
}) | undefined;
