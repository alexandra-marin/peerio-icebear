module.exports = {
    root: true,
    parser: 'babel-eslint',
    extends: [
        'peerio'
    ],
    rules: {
        'no-labels': 0,
        'no-mixed-operators': 0,
        'no-multi-assign': 1,
        'no-restricted-properties': 1
    },
    globals: {
        TextEncoder: false,
        TextDecoder: false,
        crypto: false,
        window: false,
        xdescribe: false,
        ICEBEAR_TEST_ENV: false,
        WebSocket: false,
        XMLHttpRequest: false
    }
};
