import * as T from '@babel/types';
import fs from 'fs/promises';
import { join as j } from 'path/posix';
import { findNodeModulesDir } from "../utils";
import BaseLoader from "./base";
import Scanner, { Tree } from "./scanner";
import useComptimeDecorator from '../decorator-runtime';

// TODO: apenas enviar ao client a importação e a instanciação da classe
class ManagersLoader extends BaseLoader {
    async readDir(dir: Tree) {
        const managers = new Array;

        for(const [symbol, content] of dir) {
            if(Scanner.isFile(content)) {
                if(dir.name == '@flame-oh' && symbol == 'core') continue;

                const keys = dir.keys();

                if(keys.some(f => f == 'package.json')) {
                    const meta = { isInternal: false };
                    const { main } = JSON.parse(await fs.readFile(j(dir, symbol, 'package.json'), 'utf-8'));
                    
                    const result = await this.transformFile(content as T.File, { traverse: {
                        Decorator: (path) => useComptimeDecorator(path, meta)
                    }});

                    
                } else {

                }

                const command = keys.find(f => /commands?/.test(f));

                if(command) {
                    await this.loader.commands.queueRead(j(dir, dirent.name, command));
                }
            }
            else {
                
            }
        }

        return managers;
    }

    async emitBulkFiles(managers: ReadedManager[]) {
        for(const manager of managers) {
            const result = await this.transformFile(manager.content, { filename: manager.name });
            await this.emitFile(`managers/${manager.name.replace(/\.\w+$/, '.js')}`, result);
        }
    }

    async load(tree: Tree) {
        if(!tree.has('managers')) return;
        const managersTree = tree.get('managers') as Tree;

        await Promise.all([
            (async () => {
                const managers = await this.readDir(managersTree);
                await this.emitBulkFiles(managers);
            })(),
            (async () => {
                const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh')!;
                if(!flameDir) return;

                const scanner = new Scanner(flameDir);
                const flameTree = await scanner.run();

                const managers = await this.readDir(flameTree);
                await this.emitBulkFiles(managers);
            })()
        ]);
    }
}

export default ManagersLoader;