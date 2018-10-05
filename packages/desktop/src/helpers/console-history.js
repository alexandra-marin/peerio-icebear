const safeJsonStringify = require('safe-json-stringify');

const originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug
};

console.history = {
    cache: [],
    write(timestamp, args) {
        let line = timestamp;
        for (let i = 0; i < args.length; i++) {
            if (typeof args[i] === 'object') {
                line += `${safeJsonStringify(args[i])} `;
            } else {
                line += `${args[i]} `;
            }
        }
        this.cache.push(line);
        if (this.cache.length > 1050) {
            this.cache.splice(0, 50);
        }
    },
    toString() {
        return this.cache.join('\r\n');
    }
};

const h = console.history;

console.log = function(...args) {
    const t = new Date().toISOString();
    originals.log.call(console, t, ...args);
    h.write(t, args);
};
console.warn = function(...args) {
    const t = new Date().toISOString();
    originals.warn.call(console, t, ...args);
    h.write(t, args);
};
console.error = function(...args) {
    const t = new Date().toISOString();
    originals.error.call(console, t, ...args);
    h.write(t, args);
};
console.debug = function(...args) {
    const t = new Date().toISOString();
    originals.debug.call(console, t, ...args);
    h.write(t, args);
};
