const { join: j } = require('path');
const { BannerPlugin } = require('webpack');

/** @type {import('webpack').Configuration} */
const config = {
    mode: 'production',
    entry: j(__dirname, 'src', 'cli.ts'),
    output: {
        path: j(__dirname, 'dist'),
        filename: 'cli.js',
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader'
            }
        ]
    },
    target: 'node',
    resolve: {
        extensions: ['.ts', '.js']
    },
    externals: [
        'discord.js',
        /^@rspack\//,
        /^@rsbuild\//,
        /^@babel\//,
    ],
    externalsType: 'commonjs',
    plugins: [
        new BannerPlugin({
            banner: '#!/usr/bin/env node',
            raw: true
        })
    ]
}

module.exports = config;