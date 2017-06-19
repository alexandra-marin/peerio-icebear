<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

### Table of Contents

-   [extensions/uint8array](#extensionsuint8array)
    -   [slice](#slice)
-   [index](#index)
-   [typedefs](#typedefs)
    -   [KeyPair](#keypair)

## extensions/uint8array

Uint8Array extensions and polyfills.

### slice

**Extends Uint8Array**

Returns a new Uint8Array containing a portion of current array defined by parameters.

**Parameters**

-   `begin` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** starting index in the original array.
    Can be negative to mark position counting from the end the array. (optional, default `0`)
-   `end` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** ending index (exclusive) in the original array.
    Can be negative to mark position counting from the end the array. (optional, default `this.length`)

Returns **[Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)** new array containing a range of bytes from original array.

## index

In addition to exporting public API, entry point, when first required,
performs some global configuration such as:

-   replaces global Promise object with bluebird implementation. Note that native(not transpiled) async functions
    will still return native Promise.
-   extends Uint8Array prototype. See [extensions/uint8array](#extensionsuint8array).

## typedefs

JSDoc virtually defined types. They don't really exist in code, but we define them in JSDoc for clarity.

### KeyPair

Virtual type representing asymmetric key pair.

Type: [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)

**Properties**

-   `publicKey` **[Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)** 32 bytes
-   `secretKey` **[Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)** 32 bytes