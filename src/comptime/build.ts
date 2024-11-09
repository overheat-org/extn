import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { createRsbuild, defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { dirname, join as j } from 'path';
import LoaderPlugin from './loader.plugin';
import execute from './execute';
import Config from '../config';
import { BannerPlugin } from '@rspack/core';
import { findNodeModulesDir } from '../utils';
 
const declarations = `
Object.assign(global, {
    DISEACT_COMMAND_MAP: new Map(),
    DISEACT_COLLECTOR_STATE: { listeners: new Map() },
    DISEACT_HOOK_STATE: { component: undefined, index: 0 }
});
`

async function build(coreConfig: Config, dev = false) {
    const config = defineConfig({
        source: {
            entry: { main: require.resolve('../index') },
            define: {
                COMMANDS_PATH: JSON.stringify(j(coreConfig.entryPath, 'commands')),
                MANAGERS_PATH: JSON.stringify(j(coreConfig.entryPath, 'managers')),
                FLAME_PATH: JSON.stringify(findNodeModulesDir(coreConfig.cwd, '@flame-oh')),
                INTENTS: JSON.stringify(coreConfig.intents),
                "process.env.BUILD_PATH": JSON.stringify(coreConfig.buildPath)
            },
            decorators: {
                version: '2022-03'
            },
            tsconfigPath: j(coreConfig.cwd, 'tsconfig.json')
        },
        output: {
            target: 'node',
            distPath: { root: coreConfig.buildPath }
        },
        tools: {
            rspack: {
                context: coreConfig.entryPath,
                plugins: [
                    LoaderPlugin(),
                    new BannerPlugin({
                        banner: declarations,
                        raw: true,
                        entryOnly: true,
                        test: 'main.js'
                    })
                ],
                module: {
                    rules: [
                        {
                            test: /\.zig$/,
                            loader: 'zig-loader'
                        }
                    ]
                },
                resolve: {
                    extensions: ['.ts', '.tsx', '.zig', '.js', '.jsx'],
                },
                externals: [
                    'discord.js',
                    'diseact',
                    'canva',
                    '@keyv/sqlite',
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
                        "@babel/plugin-transform-class-static-block"
                    ],
                    presets: [
                        ["@babel/preset-react", { runtime: 'automatic', importSource: 'diseact' }],
                        ["@babel/preset-typescript"]
                    ]
                }
            })
        ]
    })

    const instance = await createRsbuild({ rsbuildConfig: config, cwd: coreConfig.cwd });

    if (dev) {
        instance.onAfterBuild({ handler: () => execute(coreConfig, dev), order: 'post' })
        
        await instance.startDevServer();
        await instance.build({ watch: true });
    } else {
        await instance.build();
    }
}

export default build;