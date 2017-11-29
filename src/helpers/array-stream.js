// ArrayStream is not currently used anywhere, but I don't want to delete it, might get handy (Anri)
// todo: Add unit tests if you decide to use this class


// /**
//  * Provides access to array of Uint8Array chunks of data in a stream fashion.
//  * Currently supports only reading from stream.
//  * Underlying array can receive new data by appending(pushing) chunks to it
//  * @param {Array<Uint8Array>} array
//  * @public
//  */
// class ArrayStream {
//     constructor(array) {
//         this.arr = array;
//         this.pos = 0;
//     }
//     /**
//      * Get a portion of data from the stream without consuming it (moving stream pointer)
//      * @param {number} size
//      * @returns {?Uint8Array}
//      * @public
//      */
//     peek(size) {
//         return this.read(size, false);
//     }

//     /**
//      * Read a chunk of data from stream.
//      * @param {number} size - amount of bytes to read.
//      * @param {bool} [adjust] - default: true. Will consume data read from stream (move pointer).
//      * @returns {?Uint8Array} - array of requested size. If there's not enough
//      * data to fill array of requested size - null will be returned.
//      * @public
//      */
//     read(size, adjust = true) {
//         // do we have enough data for chunk this size?
//         if (size > this.length) return null;

//         const ret = new Uint8Array(size);
//         let retPos = 0;
//         // iterate chunks
//         for (let i = 0; i < this.arr.length && size > retPos; i++) {
//             const chunk = this.arr[i];
//             // iterate bytes inside chunk
//             for (let k = (i ? 0 : this.pos); k < chunk.length && size > retPos; k++) {
//                 ret[retPos++] = chunk[k];
//             }
//         }
//         if (adjust) this.adjustPos(size);
//         return ret;
//     }

//     /**
//      * Removes fully used chunks and adjusts position in the first chunk based on size of data read from stream
//      * @private
//      */
//     adjustPos(size) {
//         // do we even need to remove any chunks?
//         if ((this.arr[0].length - this.pos) > size) {
//             this.pos += size;
//             return;
//         }
//         // first chunk goes away for sure
//         size -= this.arr[0].length - this.pos; // eslint-disable-line
//         this.arr.shift();
//         this.pos = 0;
//         while (size > 0) {
//             if (size >= this.arr[0].length) {
//                 size -= this.arr[0].length; // eslint-disable-line
//                 this.arr.shift();
//             } else {
//                 this.pos = size;
//                 break;
//             }
//         }
//     }

//     /**
//      * Current stream length (from current position to the end of stream)
//      * @returns {number} - available byte length
//      * @public
//      */
//     get length() {
//         if (!this.arr.length) return 0;
//         let ret = this.arr[0].length - this.pos;
//         for (let i = 1; i < this.arr.length; i++) {
//             ret += this.arr[i].length;
//         }
//         return ret;
//     }
// }

// module.exports = ArrayStream;
