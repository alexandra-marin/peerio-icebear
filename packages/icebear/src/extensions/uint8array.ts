/**
 * Uint8Array extensions and polyfills.
 */
(function() {
    'use strict';

    if (typeof Uint8Array.prototype.slice === 'undefined') {
        /**
         * Returns a new Uint8Array containing a portion of current array defined by parameters.
         * @param begin - starting index in the original array.
         * Can be negative to mark position counting from the end the array.
         * @param end - ending index (exclusive) in the original array.
         * Can be negative to mark position counting from the end the array.
         * @returns new array containing a range of bytes from original array.
         */
        Uint8Array.prototype.slice = function(begin = 0, end?: number): Uint8Array {
            /* eslint-disable no-param-reassign */
            if (begin < 0) begin = Math.max(0, this.length + begin);
            end = typeof end === 'number' ? Math.min(this.length, end) : this.length;
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
})();
