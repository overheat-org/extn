import './polyfills';
import { join as j } from 'path';
import Config from '../config';
import fs from 'fs/promises';
import execute from './execute';
import { fileURLToPath } from 'url';
import Graph from './graph';
import Transformer from './transformer';

async function build(config: Config, dev = false, ...args: string[]) {
    await prepareBuildDirectory(config.buildPath);
    
    const graph = new Graph(config);
    const transformer = new Transformer(graph, config);

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