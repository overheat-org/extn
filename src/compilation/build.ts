import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { createRsbuild, defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { join as j } from 'path/posix';
import execute from './execute';
import Config from '../config';
import { BannerPlugin, DefinePlugin } from '@rspack/core';
import Loader from '../loader';
import fs from 'fs/promises';

const declarations = `
Object.assign(global, {
    DISEACT_COMMAND_MAP: new Map(),
    DISEACT_COLLECTOR_STATE: { listeners: new Map() },
    DISEACT_HOOK_STATE: { component: undefined, index: 0 }
});
`;

async function build(coreConfig: Config, dev = false, ...args) {
    await prepareFlameDirectory(coreConfig.buildPath);
    
    const loader = new Loader(coreConfig);
    await loader.run();

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
                target: 'node2022',
                entry: {
                    index: j(coreConfig.buildPath, 'index'),
                    commands: j(coreConfig.buildPath, 'commands')
                },
                plugins: [
                    new BannerPlugin({
                        banner: declarations,
                        raw: true,
                        entryOnly: true,
                        test: 'main.js'
                    }),
                    new DefinePlugin({
                        INTENTS: JSON.stringify(coreConfig.intents),
                        // TODO: isso nao funciona, temos que separar o index 
                        // MANAGERS: injectedManagers.join('\n\n'),
                        "BUILD_PATH": JSON.stringify(coreConfig.buildPath)
                    }),
                ],
                module: {
                    rules: [
                        {
                            test: /\.zig$/,
                            loader: 'zig-loader'
                        },
                    ]
                },
                resolve: {
                    extensions: ['.ts', '.tsx', '.zig', '.js', '.jsx'],
                    tsConfig: j(coreConfig.cwd, 'tsconfig.json')
                },
                externals: [
                    'discord.js',
                    'canvas',
                    'keyv',
                    '@flame-oh/core',
                    'webpack',
                    /^diseact(\/.*)?$/,
                    /^@rspack\//,
                    /^@rsbuild\//,
                    /^@swc\//,
                    /^@keyv\//,
                    {
                        './commands': j(coreConfig.buildPath, 'commands.js') 
                    },
                ],
                output: {
                    path: coreConfig.buildPath,
                    filename: "[name].js",
                    libraryTarget: 'module',
                    chunkFormat: 'module',
                    chunkFilename(arg) {
                        if(arg.chunk?.id?.includes('managers')) {
                            const splitted = arg.chunk.id.split('_');
                            const name = splitted[splitted.length - 2];

                            return `managers/${name}.js`;
                        }

                        return '[name].js';
                    }
                },
                experiments: {
                    outputModule: true,
                },
                optimization: {
                    runtimeChunk: false,
                    splitChunks: false,
                    minimize: true,
                },
            }
        },
        plugins: [
            pluginNodePolyfill(),
            pluginBabel({
                include: /\.(t|j)sx?$/,
                exclude: [/\.d\.ts$/],
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
                },
            })
        ],
    });
    
    const instance = await createRsbuild({ rsbuildConfig: config, cwd: coreConfig.cwd });

    if (dev) {
        instance.onAfterBuild({ handler: () => execute(coreConfig, dev, ...args), order: 'post' });

        await instance.startDevServer();
        await instance.build();
    } else {
        await instance.build();
    }
}

async function prepareFlameDirectory(buildPath) {
    try {
        const flameDir = buildPath;

        try {
            const files = await fs.readdir(flameDir);

            for (const file of files) {
                const filePath = j(flameDir, file);
                const stat = await fs.stat(filePath);
    
                if (stat.isDirectory()) {
                    await fs.rm(filePath, { recursive: true });
                } else {
                    await fs.unlink(filePath);
                }
            }
        } catch {
            await fs.mkdir(flameDir, { recursive: true });
        }
    } catch (error: any) {
        console.error(`Erro ao preparar o diretório .flame: ${error.message}`);
    }
}

export default build;