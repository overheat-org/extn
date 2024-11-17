import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { createRsbuild, defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import path, { basename, join as j, resolve as r } from 'path';
import execute from './execute';
import Config from '../config';
import { BannerPlugin, DefinePlugin } from '@rspack/core';
import { findNodeModulesDir } from '../utils';
import Loader from '../loader';
import crypto from 'crypto';
import fs from 'fs/promises';

const declarations = `
Object.assign(global, {
    DISEACT_COMMAND_MAP: new Map(),
    DISEACT_COLLECTOR_STATE: { listeners: new Map() },
    DISEACT_HOOK_STATE: { component: undefined, index: 0 }
});
`

async function build(coreConfig: Config, dev = false) {
    await prepareFlameDirectory(coreConfig.buildPath);
    
    const loader = new Loader(coreConfig);

    const { injectedManagers, managersPath } = await loader.run() ?? { injectedManagers: [], managersPath: [] };

    const config = defineConfig({
        output: {
            target: 'node'
        },
        source: {
            decorators: {
                version: '2022-03'
            },
            tsconfigPath: j(coreConfig.cwd, 'tsconfig.json'),
        },
        tools: {
            rspack: {
                entry: {
                    main: {
                        import: j(__dirname, 'client'),
                        dependOn: 'commands',
                    },
                    commands: j(coreConfig.buildPath, 'commands'),
                    ...Object.assign({}, ...managersPath.map(p => ({ [`managers/${basename(p, path.extname(p))}`]: p })))
                },
                target: 'node',
                plugins: [
                    new BannerPlugin({
                        banner: declarations,
                        raw: true,
                        entryOnly: true,
                        test: 'main.js'
                    }),
                    new DefinePlugin({
                        COMMANDS_PATH: JSON.stringify(j(coreConfig.entryPath, 'commands')),
                        MANAGERS_PATH: JSON.stringify(j(coreConfig.entryPath, 'managers')),
                        FLAME_PATH: JSON.stringify(findNodeModulesDir(coreConfig.cwd, '@flame-oh')),
                        INTENTS: JSON.stringify(coreConfig.intents),
                        // TODO: isso nao funciona, temos que separar o index 
                        MANAGERS: injectedManagers.join('\n\n'),
                        "process.env.BUILD_PATH": JSON.stringify(coreConfig.buildPath)
                    })
                ],
                module: {
                    rules: [
                        {
                            test: /\.zig$/,
                            loader: 'zig-loader'
                        },
                        {
                            test: /\.(t|j)sx?$/,
                            exclude: [/\.d\.ts$/]
                        }
                    ]
                },
                resolve: {
                    extensions: ['.ts', '.tsx', '.zig', '.js', '.jsx'],
                    tsConfig: r(coreConfig.cwd, 'tsconfig.json')
                },
                externals: [
                    'discord.js',
                    'diseact',
                    'canvas',
                    'keyv',
                    '@flame-oh/core',
                    'webpack',
                    /^@rspack\//,
                    /^@rsbuild\//,
                    /^@swc\//,
                    /^@keyv\//,
                ],
                output: {
                    path: coreConfig.buildPath,
                    filename: "[name].js",
                    libraryTarget: 'commonjs2',
                },
                optimization: {
                    splitChunks: {
                        chunks: 'all',
                        name: `chunks/${crypto.randomBytes(8 / 2).toString('hex')}`
                    },
                    runtimeChunk: 'single',
                    minimize: true,
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
    });

    const instance = await createRsbuild({ rsbuildConfig: config, cwd: coreConfig.cwd });

    if (dev) {
        instance.onAfterBuild({ handler: () => execute(coreConfig, dev), order: 'post' })

        await instance.startDevServer();
        await instance.build();
    } else {
        await instance.build();
    }
}

async function prepareFlameDirectory(buildPath) {
    try {
        const flameDir = buildPath;

        // Verifica se o diretório existe
        try {
            const files = await fs.readdir(flameDir);

            for (const file of files) {
                const filePath = j(flameDir, file);
                const stat = await fs.stat(filePath);
    
                if (stat.isDirectory()) {
                    await fs.rmdir(filePath, { recursive: true });
                } else {
                    await fs.unlink(filePath);
                }
            }
        } catch {
            // Diretório não existe, cria
            await fs.mkdir(flameDir, { recursive: true });
        }
    } catch (error: any) {
        console.error(`Erro ao preparar o diretório .flame: ${error.message}`);
    }
}

export default build;