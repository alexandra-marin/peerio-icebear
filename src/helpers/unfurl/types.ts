export type ExternalContent = ExternalWebsite | ExternalImage;

export type ExternalWebsite = {
    type: 'html';
    url: string;
    siteName: string;
    title?: string;
    description?: string;
    favicon?: ExternalImage;
    image?: ExternalImage;
};

export type ExternalImage = {
    type: 'image';
    url: string;
    length: number;
    isOverInlineSizeLimit: boolean;
    isOversizeCutoff: boolean;
    isInsecure: boolean;
};
