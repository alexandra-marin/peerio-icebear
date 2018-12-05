export type ExternalImage = {
    type: 'image';
    url: string;
    contentType?: string;
    length: number;
    isOverInlineSizeLimit: boolean;
    isOversizeCutoff: boolean;
    isInsecure: boolean;
};

export type ExternalWebsite = {
    type: 'html';
    url: string;
    siteName: string;
    title?: string;
    description?: string;
    favicon?: ExternalImage;
    image?: ExternalImage;
    imageAlt?: string;
};

export type ExternalContent = ExternalWebsite | ExternalImage;
