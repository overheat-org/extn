
import * as T from '@babel/types';
import { dirname, join as j } from 'path/posix';
import BaseLoader from "./base";
import useComptimeDecorator from '../decorator-runtime';
import ImportResolver from './import-resolver';
import { findNodeModulesDir } from '../utils';
import { FLAME_MANAGER_REGEX, SUPPORTED_EXTENSIONS_REGEX } from '../consts';

const FLAME_OH = "@flame-oh";
const EXCLUDE_DIRS = [
    "node_modules",
    ".git",
    ".bin"
]

class ManagersLoader extends BaseLoader {
    importResolver = new ImportResolver(j(this.config.entryPath, 'managers'), this.config);
    
    async loadDir(path: string) {
        for(const dirent of await this.readDir(path)) {
            const filename = dirent.name;
            const filepath = j(dirent.parentPath, filename);
            
            if(dirent.isFile() && SUPPORTED_EXTENSIONS_REGEX.test(filename)) {
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
                    
                    let relativeFilepath = filepath.replace(this.config.entryPath, '').replace(/\.\w+$/, '.js');
                    if(meta.injects.length > 0) {
                        this.loader.client.injections[j(this.config.buildPath, relativeFilepath)] = meta.injects;
                    }

                    if(relativeFilepath.includes(FLAME_OH)) {
                        const startIndex = relativeFilepath.indexOf(FLAME_OH) + FLAME_OH.length + 1;
                        relativeFilepath = relativeFilepath.substring(startIndex).replace('manager-', 'managers/');
                    }
                    
                    await this.emitFile(relativeFilepath, result);
                }
            } else {
                if(EXCLUDE_DIRS.includes(dirent.name)) continue;

                await this.loadDir(filepath);
            }
        }
    }
    
    async load() {
        await Promise.all([
            this.loadDir(j(this.config.entryPath, 'managers')),

            (async () => {
                const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh')!;
                if(!flameDir) return;

                const managersDirent = (await this.readDir(flameDir)).filter(d => d.name.startsWith('manager-'));

                for(const dirent of managersDirent) {
                    const direntPath = j(dirent.parentPath, dirent.name);

                    const packageJson = await this.readFile(j(direntPath, 'package.json'));
                    await this.loadDir(packageJson.main ? dirname(j(direntPath, packageJson.main)) : flameDir);
                }
            })()
        ]);
    }
}

export default ManagersLoader;