const { join: j } = require('path');
const { BannerPlugin } = require('webpack');

/** @type {import('webpack').Configuration} */
const config = {
    entry: j(__dirname, 'src', 'cli.ts'),
    output: {
        path: j(__dirname, 'lib'),
        filename: 'cli.js',
    },
    target: 'node',
    externals: {
        './compilation/build': 'commonjs ./compilation/build',
        './compilation/execute': 'commonjs ./compilation/execute',
        './config': 'commonjs ./config',
    },
    plugins: [
        new BannerPlugin({
            banner: '#!/usr/bin/env node',
            raw: true
        })
    ]
}

module.exports = config;