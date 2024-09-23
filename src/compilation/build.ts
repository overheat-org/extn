/**
 * @comptime This file will be executed on compilation.
 */

import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { createRsbuild, defineConfig } from '@rsbuild/core';
import LoaderPlugin from './loader';
import { join as j } from 'path';
import { pluginBabel } from '@rsbuild/plugin-babel';
import execute from './execute';
import Config from '../config';

async function build(coreConfig: Config, dev = false) {
    const config = defineConfig({
        source: {
            entry: { main: require.resolve('../index') },
            define: {
                COMMANDS_PATH: JSON.stringify(j(coreConfig.entryPath, 'commands')),
                MANAGERS_PATH: JSON.stringify(j(coreConfig.entryPath, 'managers'))
            },
            decorators: {
                version: '2022-03'
            },
        },
        output: {
            target: 'node',
            distPath: { root: coreConfig.buildPath }
        },
        tools: {
            rspack: {
                context: coreConfig.entryPath,
                plugins: [
                    LoaderPlugin()
                ],
                externals: [
                    'discord.js',
                    'diseact'
                ],
                optimization: {
                    splitChunks: {
                        chunks: 'all'
                    },
                },
            }
        },
        plugins: [
            pluginNodePolyfill(),
            pluginBabel({
                babelLoaderOptions: {
                    plugins: [
                        ["@babel/plugin-proposal-decorators", { version: "2023-05" }],
                        "@babel/plugin-proposal-class-properties",
                        "@babel/plugin-transform-class-static-block",
                    ],
                    presets: [
                        ["@babel/preset-react", { runtime: 'automatic', importSource: 'diseact' }],
                        ["@babel/preset-typescript"]
                    ]
                }
            })
        ]
    })

    const instance = await createRsbuild({ rsbuildConfig: config, cwd: coreConfig.entryPath });

    if (dev) {
        await instance.startDevServer();
        await instance.build();

        execute(coreConfig, dev);
    } else {
        await instance.build();
    }
}

export default build;