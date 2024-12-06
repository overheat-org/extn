import traverse from "@babel/traverse";
import generate from '@babel/generator';
import { parse } from "@babel/parser";
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

interface ParsedManager {
    path: string;
    isInternal: boolean;
    content: T.Statement[] | string;
}

export type ReadedManager = { name: string, content: T.Statement[] };

class ManagersLoader extends BaseLoader {
    async parseFile(filePath: string) { 
        const buf = await fs.readFile(filePath);
        const ast = parse(buf.toString('utf-8'), {
            sourceType: 'module',
            plugins: ['typescript', 'decorators', 'jsx'],
        });
        
        const meta = { isInternal: false };
        
        traverse(ast!, {
            Decorator: (path) => useComptimeDecorator(path, meta)
        });

        return {
            path: filePath,
            isInternal: meta.isInternal,
            content: ast?.program.body
        } as ParsedManager;
    }

    async parseDir(path: string) {
        let isInternal = false;

        const result = await esbuild.build({
            entryPoints: [path],
            bundle: true,
            format: 'esm',
            write: false,
            plugins: [
                nodeExternals(),
                {
                    name: 'modify-index',
                    setup: (build) => {
                        build.onLoad({ filter: /index/ }, async (args) => {
                            const parsed = await this.parseFile(args.path);
                            const contents = generate(T.program(parsed.content as T.Statement[])).code;
                            
                            isInternal = parsed.isInternal;
                            
                            return {
                                contents,
                                loader: 'tsx',
                            }
                        })
                    },
                }
            ]
        });

        return {
            isInternal,
            path,
            content: result.outputFiles[0].text,
        } as ParsedManager;
    }
    
    async readDir(dir: string) {
        const content = await fs.readdir(dir, { withFileTypes: true });
        const managers = new Array<ReadedManager>;
        const internalManagers = new Array<ReadedManager>;

        for(const dirent of content) {
            let parsed!: ParsedManager;
            
            if(!dirent.isFile()) {
                if(dir.includes('@flame-oh') && dirent.name == 'core') continue;
                
                const files = await fs.readdir(j(dir, dirent.name));
                
                if(files.some(f => f.startsWith('index'))) {
                    parsed = await this.parseDir(j(dir, dirent.name, 'index'));
                }
                else if(files.includes('package.json')) {
                    const data = JSON.parse(await fs.readFile(j(dir, dirent.name, 'package.json'), 'utf-8'))
                    parsed = await this.parseDir(j(dir, dirent.name, data.main));
                }

                const command = files.find(f => /commands?/.test(f));
                
                // TODO: os comandos aqui está com o path errado
                if(command) {
                    await this.loader.commands.queueRead(j(dir, dirent.name, command));
                }
            }
            else parsed = await this.parseFile(j(dir, dirent.name));

            if(/manager-/.test(dirent.name)) dirent.name = dirent.name.replace(/manager-/, '') + '.js';

            const content = typeof parsed.content == 'string'
                ? parse(parsed.content, { sourceType: 'module' }).program.body
                : parsed.content;

            (parsed.isInternal 
                ? internalManagers 
                : managers
            ).push({ name: dirent.name, content });
        }

        return { managers, internalManagers };
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
                const { managers, internalManagers } = await this.readDir(managersDir);
    
                this.loader.client.internalManagers.push(...internalManagers);
                await this.emitBulkFiles(managers);
            })(),
            
            (async () => {
                const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh')!;
                if(!flameDir) return;
                const { managers, internalManagers } = await this.readDir(flameDir);
                
                this.loader.client.internalManagers.push(...internalManagers);
                await this.emitBulkFiles(managers);
            })()
        ]);
    }

    constructor(protected config: Config, private loader: Loader) {
        super(config);
    }
}

export default ManagersLoader;