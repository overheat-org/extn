/**
 * @comptime This file will be executed on compilation.
 */

import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { createRsbuild, defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { join as j } from 'path';
import LoaderPlugin from './loader';
import execute from './execute';

async function build(cwd: string, dev = false) {
    const config = defineConfig({
        source: {
            entry: { main: require.resolve('../index') },
            define: {
                COMMANDS_PATH: JSON.stringify(j(cwd, 'commands')),
                MANAGERS_PATH: JSON.stringify(j(cwd, 'managers'))
            },
            decorators: {
                version: '2022-03'
            },
        },
        output: {
            target: 'node',
            distPath: { root: j(cwd, '.flame') }
        },
        tools: {
            rspack: {
                context: cwd,
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

    const instance = await createRsbuild({ rsbuildConfig: config, cwd });

    if (dev) {
        await instance.startDevServer();
        await instance.build();

        execute(cwd, dev);
    } else {
        await instance.build();
    }
}

export default build;