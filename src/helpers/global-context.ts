let g: any;
if (typeof window !== 'undefined') {
    g = window;
} else if (typeof global !== 'undefined') {
    g = global;
} else {
    g = self;
}
export default g;
