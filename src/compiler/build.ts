import './polyfills';
import * as T from '@babel/types';
import { join as j } from 'path';
import Config from '../config';
import fs from 'fs/promises';
import execute from './execute';
import { replacement } from '@meta-oh/replacer/babel';
import { fileURLToPath } from 'url';
import Graph from './graph';
import Transformer from './transformer';
import { parseExpression } from '@babel/parser';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function build(config: Config, dev = false, ...args: string[]) {
    await prepareBuildDirectory(config.buildPath);
    
    const graph = new Graph(config);
    const transformer = new Transformer(graph, config);

    replacement.set('INTENTS', [
        T.variableDeclaration('const', [
            T.variableDeclarator(
                T.identifier('intents'),
                parseExpression(typeof config.intents == 'string' ? config.intents : JSON.stringify(config.intents))
            )
        ])
    ]);

    await transformer.run();
    await graph.build();

    // if(dev) execute(config, dev, ...args);
}

async function prepareBuildDirectory(buildPath) {
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