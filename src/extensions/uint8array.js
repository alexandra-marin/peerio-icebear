/**
 * Uint8Array extensions and polyfills.
 */

if (typeof (Uint8Array.prototype.slice) === 'undefined') {
    /**
     * Returns a new Uint8Array containing a portion of current array defined by parameters.
     * @param {number} [begin=0] - starting index in the original array.
     * Can be negative to mark position counting from the end the array.
     * @param {number} [end=this.length] - ending index (exclusive) in the original array.
     * Can be negative to mark position counting from the end the array.
     * @returns {Uint8Array} new array containing a range of bytes from original array.
     * @extends Uint8Array
     */
    Uint8Array.prototype.slice = function(begin, end) {
        /* eslint-disable no-param-reassign */
        begin = begin || 0;
        if (begin < 0) begin = Math.max(0, this.length + begin);
        end = typeof (end) === 'number' ? Math.min(this.length, end) : this.length;
        if (end < 0) end = this.length + end;
        /* eslint-enable no-param-reassign */

        const size = end - begin;
        if (size <= 0) return new Uint8Array();

        const ret = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            ret[i] = this[begin + i];
        }
        return ret;
    };
}
