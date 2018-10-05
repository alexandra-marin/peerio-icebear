module.exports = function(api) {
    api.cache.never();
    return {
        compact: false,
        presets: ['@babel/preset-typescript', '@babel/preset-react'],
        plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-proposal-class-properties', { loose: true }],
            [
                '@babel/plugin-proposal-object-rest-spread',
                { useBuiltIns: true }
            ],
            ['babel-plugin-root-import', { rootPathSuffix: 'build' }],
            [
                '@babel/plugin-transform-modules-commonjs',
                {
                    allowTopLevelThis: true
                }
            ],
            [
                '@babel/transform-async-to-generator',
                {
                    module: 'bluebird',
                    method: 'coroutine'
                }
            ]
        ],
        ignore: ['src/static'],
        env: {
            production: {
                sourceMaps: false,
                comments: false
            },
            development: {
                sourceMaps: true,
                presets: [['@babel/preset-react', { development: true }]]
            }
        }
    };
};
