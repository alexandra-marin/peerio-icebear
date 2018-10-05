// type defs in @types/rimraf are messed up
// this definition is not complete
declare module 'rimraf' {
    export default function rimraf(
        path: string,
        { disableGlob: boolean },
        callback: (err: Error) => void
    ): void;
}
