let g;
if (typeof window !== 'undefined') {
    g = window;
} else if (typeof global !== 'undefined') {
    g = global;
} else {
    g = self; // eslint-disable-line no-undef
}
module.exports = g;
