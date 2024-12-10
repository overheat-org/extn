import * as T from '@babel/types';
import { join as j } from 'path/posix';
import BaseLoader from "./base";
import Scanner, { Tree } from "./scanner";
import useComptimeDecorator from '../decorator-runtime';

class ManagersLoader extends BaseLoader {
    async readDir(dir: Tree, accPath: string = dir.name) {
        for(const [symbol, content] of dir) {
            if(Scanner.isFile(content)) {
                if(/commands?/.test(symbol)) {
                    await this.loader.commands.queueRead(content);
                }
                else {
                    const meta = { injects: [] };
                
                    const result = await this.transformFile(content as T.File, { traverse: {
                        Decorator: (path) => useComptimeDecorator(path, meta)
                    }});
    
                    this.loader.client.injectedManagers[symbol] = meta.injects;
                    await this.emitFile(`managers/${accPath.replace(/\.\w+$/, '.js')}`, result);
                }
            }
            else {
                if(dir.name == '@flame-oh' && symbol == 'core') continue;
    
                await this.readDir(content, j(accPath, symbol));
            }
        }
    }

    async load(tree: Tree) {
        const managersTree = tree.get('managers') as Tree;
        if(!managersTree) return;

        // const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh')!;
        // if(!flameDir) return;

        // const scanner = new Scanner(flameDir);
        // const flameTree = await scanner.run();

        await Promise.all([
            this.readDir(managersTree),
            // this.readDir(flameTree)
        ]);
    }
}

export default ManagersLoader;