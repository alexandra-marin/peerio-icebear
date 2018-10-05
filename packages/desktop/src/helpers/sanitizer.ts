import DOMPurify from 'dompurify';

const chatMsgOptions = {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
};

export function sanitizeChatMessage(msg: string): string {
    return DOMPurify.sanitize(msg, chatMsgOptions);
}
