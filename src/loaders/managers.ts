
import * as T from '@babel/types';
import { basename, join as j } from 'path/posix';
import BaseLoader from "./base";
import useComptimeDecorator from '../decorator-runtime';
import ImportResolver from './import-resolver';

class ManagersLoader extends BaseLoader {
    importResolver = new ImportResolver(j(this.config.entryPath, 'managers'), this.config);
    
    async loadDir(path: string) {
        console.log({path})

        for(const dirent of await this.readDir(path)) {
            const filename = dirent.name;
            const filepath = j(dirent.parentPath, filename);

            if(dirent.isFile()) {
                const content = await this.parseFile(filepath);

                if (/commands?/.test(filename)) {
                    await this.loader.commands.queueRead(content);
                } else {
                    const meta = { injects: [] };
    
                    const result = await this.transformFile(content as T.File, {
                        filename,
                        traverse: {
                            Decorator: (path) => useComptimeDecorator(path, meta),
                            ImportDeclaration: (path) => this.importResolver.resolve(path)
                        }
                    });
    
                    this.loader.client.injections[filename] = meta.injects;
                    await this.emitFile(j('managers', filename.replace(/\.\w+$/, '.js')), result);
                }
            } else {
                if (basename(dirent.parentPath) == '@flame-oh' && filename == 'core') continue;
    
                await this.loadDir(filepath);
            }
        }
    }
    
    async load() {
        await Promise.all([
            this.loadDir(j(this.config.entryPath, 'managers')),

            // (async () => {
            //     const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh')!;
            //     console.log({flameDir})
            //     if(!flameDir) return;

            //     return this.readDir(flameDir);
            // })()
        ]);
    }
}

export default ManagersLoader;