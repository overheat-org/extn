import traverse from "@babel/traverse";
import * as T from '@babel/types';
import fs from 'fs/promises';
import Config from "../config";
import { join as j } from 'path/posix';
import { findNodeModulesDir } from "../utils";
import BaseLoader from "./base";
import Loader from ".";
import esbuild from "esbuild";
import useComptimeDecorator from "../decorator-runtime";
import { nodeExternals } from 'esbuild-plugin-node-externals';
import ImportRegistry from './import-registry';

interface ParsedManager {
    path: string;
    injects: Array<string>;
    body: T.Statement[];
}

export type ReadedManager = { name: string, content: T.Statement[] };

// TODO: apenas enviar ao client a importação e a instanciação da classe
class ManagersLoader extends BaseLoader {
    async intermediateParseFile(filePath: string) { 
        const buf = await fs.readFile(filePath);
        const ast = this.parseFile(buf.toString('utf-8'));
        
        const meta: Pick<ParsedManager, 'injects'> = { injects: [] };
        
        traverse(ast!, {
            Decorator: (path) => useComptimeDecorator(path, meta)
        });

        return {
            path: filePath,
            injects: meta.injects,
            body: ast?.program.body
        } as ParsedManager;
    }

    async parseDir(path: string) {
        const injects = new Array<string>;

        const result = await esbuild.build({
            entryPoints: [path],
            bundle: true,
            format: 'esm',
            write: false,
            platform: 'node',
            plugins: [
                nodeExternals(),
                {
                    name: 'modify-index',
                    setup: (build) => {
                        build.onLoad({ filter: /./ }, async (args) => {
                            const parsed = await this.intermediateParseFile(args.path);
                            
                            injects.push(...parsed.injects);
                            
                            return {}
                        })
                    },
                }
            ]
        });

        return {
            path,
            injects,
            content: result.outputFiles[0].text,
        };
    }
    
    async readDir(dir: string) {
        const content = await fs.readdir(dir, { withFileTypes: true });
        const managers = new Array<ReadedManager>;
        const importManager = new ImportRegistry({ 
            from: j(this.config.entryPath, 'managers'), 
            to: j(this.config.buildPath, 'managers')
        });
        const injectsMap : Record<string, string[]> = {};

        for(const dirent of content) {
            let parsed!: ParsedManager;
            
            if(!dirent.isFile()) {
                if(dir.includes('@flame-oh') && dirent.name == 'core') continue;
                
                const files = await fs.readdir(j(dir, dirent.name));
                
                if(files.some(f => f.startsWith('index'))) {
                    const { injects, path, content } = await this.parseDir(j(dir, dirent.name, 'index'));

                    parsed = {
                        injects,
                        body: this.parseFile(content).program.body,
                        path
                    }
                }
                else if(files.includes('package.json')) {
                    const data = JSON.parse(await fs.readFile(j(dir, dirent.name, 'package.json'), 'utf-8'))
                    const { injects, path, content } = await this.parseDir(j(dir, dirent.name, data.main));

                    parsed = {
                        injects,
                        body: this.parseFile(content).program.body,
                        path
                    }
                }

                const command = files.find(f => /commands?/.test(f));
                
                // TODO: os comandos aqui está com o path errado
                if(command) {
                    await this.loader.commands.queueRead(j(dir, dirent.name, command));
                }
            }
            else parsed = await this.intermediateParseFile(j(dir, dirent.name));

            injectsMap[parsed.path] = parsed.injects;

            if(/manager-/.test(dirent.name)) dirent.name = dirent.name.replace(/manager-/, '') + '.js';

            importManager.parse(parsed.body, { clearImportsBefore: true });
            parsed.body = importManager.resolve(parsed.body);

            managers.push({ name: dirent.name, content: parsed.body });
        }

        return {managers, injectsMap};
    }

    async emitBulkFiles(managers: ReadedManager[]) {
        for(const manager of managers) {
            const result = await this.transformFile(T.program(manager.content), { filename: manager.name });
            await this.emitFile(`managers/${manager.name.replace(/\.\w+$/, '.js')}`, result);
        }
    }

    async load() {
        await Promise.all([
            (async () => {
                const managersDir = j(this.config.entryPath, 'managers'); 
                const { managers, injectsMap } = await this.readDir(managersDir);
    
                this.loader.client.injectedManagers = { ...this.loader.client.injectedManagers, ...injectsMap };
                await this.emitBulkFiles(managers);
            })(),
            
            (async () => {
                const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh')!;
                if(!flameDir) return;
                const { managers, injectsMap } = await this.readDir(flameDir);
                
                this.loader.client.injectedManagers = { ...this.loader.client.injectedManagers, ...injectsMap };
                await this.emitBulkFiles(managers);
            })()
        ]);
    }

    constructor(protected config: Config, private loader: Loader) {
        super(config);
    }
}

export default ManagersLoader;