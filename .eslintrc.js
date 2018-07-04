module.exports = {
    root: true,
    parser: 'babel-eslint',
    extends: [
        'peerio/index.base.js'
    ],
    rules: {
        'no-labels': 0,
        'no-mixed-operators': 0,
        'no-multi-assign': 0,
        'no-restricted-properties': 1,
        'no-void': 0,
        'prefer-arrow-callback': 0,
        'no-debugger': 0,
        'prefer-destructuring': 0,
        'no-await-in-loop': 0
    },
    globals: {
        TextEncoder: false,
        TextDecoder: false,
        crypto: false,
        window: false,
        xdescribe: false,
        WebSocket: false,
        XMLHttpRequest: false,
        performance: false
    }
};
