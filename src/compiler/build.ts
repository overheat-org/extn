import { join as j, resolve } from 'path';
import Config from '../config';
import fs from 'fs/promises';
import execute from './execute';
import esbuild from 'esbuild';
import ReplacerPlugin, { replacement } from '@meta-oh/replacer';
import { fileURLToPath } from 'url';
import { CommandLoader } from './loaders/commands';
import { ManagerLoader } from './loaders/managers';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function build(config: Config, dev = false, ...args: string[]) {
    await prepareFlameDirectory(config.buildPath);
    
    replacement.set('INTENTS', `
        const INTENTS = ${JSON.stringify(config.intents)}    
    `);

    await esbuild.build({
        entryPoints: [resolve(__dirname, './static/client.template.js')],
        plugins: [
            ReplacerPlugin(),
            ManagerLoader(config),
            CommandLoader(config),
        ],
        outfile: j(config.buildPath, "index.js"),
    })
    
    // if(dev) execute(config, dev, ...args);
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