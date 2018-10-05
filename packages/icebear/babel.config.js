module.exports = function(api) {
    api.cache.never();
    return {
        compact: false,
        presets: ['@babel/preset-typescript'],
        plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-proposal-class-properties', { loose: true }],
            [
                '@babel/plugin-proposal-object-rest-spread',
                { useBuiltIns: true }
            ],
            // root-import is used in tests! we might want to ensure that it's
            // not used elsewhere (or just colocate our tests and get rid of the
            // need for this plugin)
            ['babel-plugin-root-import', { rootPathSuffix: 'src' }],
            '@babel/plugin-transform-modules-commonjs',
            [
                '@babel/transform-async-to-generator',
                {
                    module: 'bluebird',
                    method: 'coroutine'
                }
            ]
        ]
    };
};
