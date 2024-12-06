const { join: j } = require('path');
const { BannerPlugin } = require('webpack');

/** @type {import('webpack').Configuration} */
const config = {
    mode: 'production',
    entry: j(__dirname, 'src', 'cli.ts'),
    output: {
        path: j(__dirname, 'dist'),
        filename: 'cli.cjs',
        libraryTarget: 'commonjs2'
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: [/\.d\.ts$/, /helpers/],
                loader: 'ts-loader',
                options: {
                    transpileOnly: true
                }
            },
            {
                test: [/\.d\.ts$/, /helpers/],
                loader: 'ignore-loader'
            },
        ]
    },
    target: 'node',
    resolve: {
        extensions: ['.ts', '.js']
    },
    externals: [
        'discord.js',
        'diseact',
        /^@rspack\//,
        /^@rsbuild\//,
        /^@babel\//,
    ],
    optimization: {
        minimize: false,
    },
    plugins: [
        new BannerPlugin({
            banner: '#!/usr/bin/env node',
            raw: true
        })
    ]
}

module.exports = config;