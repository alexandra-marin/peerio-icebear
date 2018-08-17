declare module 'pdfform.js' {
    export default function pdfform(): {
        transform: (input: ArrayBuffer, fields: Object) => ArrayBuffer;
    };
}
