module.exports = function(api) {
    api.cache.never();
    return {
        compact: false,
        presets: ['@babel/preset-typescript'],
        plugins: [
            ['@babel/plugin-proposal-decorators',{ legacy: true }],
            ['@babel/plugin-proposal-class-properties',{ loose: true }],
            [
                '@babel/plugin-proposal-object-rest-spread',
                { useBuiltIns: true }
            ],
            ['babel-plugin-root-import',{ rootPathSuffix: 'dist' }],
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
