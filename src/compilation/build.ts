import { join as j } from 'path/posix';
import Config from '../config';
import Loader from '../loader';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import execute from './execute';

async function build(coreConfig: Config, dev = false, ...args: string[]) {
    await prepareFlameDirectory(coreConfig.buildPath);
    
    const loader = new Loader(coreConfig, dev);
    await loader.run();

    if(dev) execute(coreConfig, dev, ...args);
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

function checkAlias(request, tsconfigPath) {
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
    const paths = tsconfig.compilerOptions.paths || {};

    // Iterar sobre os aliases definidos
    for (const alias in paths) {
        const pattern = paths[alias];

        // Verificar se o alias contém um curinga (por exemplo, @/*)
        if (alias.includes('*')) {
            const aliasPrefix = alias.replace('*', ''); // Remover o '*' do alias
            if (request.startsWith(aliasPrefix)) {
                return true; // Encontrou o alias com curinga
            }
        }
        else if (request === alias) {
            return true; // Alias exato
        }
    }
    return false;
}

export default build;