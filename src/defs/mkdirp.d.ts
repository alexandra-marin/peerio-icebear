// type defs in @types/mkdirp@5.0.2 are messed up
// this definition is not complete
declare module 'mkdirp' {
    export default function mkdirp(path: string, callback: (err: Error) => void): void;
}
