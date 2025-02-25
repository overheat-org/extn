import * as T from '@babel/types';
import fs from 'fs/promises';
import { basename } from 'path';
import Config from '../config';
import { toPosix } from './utils';
import _generate from '@babel/generator';

const generate: typeof _generate = typeof _generate == 'object'
    ? (_generate as any).default
    : _generate;

interface ModuleOptions { filename?: string }

class Injection {
    id: T.Identifier;
    
    constructor(
        id: string,
        public module: Module
    ) {
        this.id = T.identifier(id);
    }
}

export class Module implements ModuleOptions {
    public filename: string;
    
    constructor(
        public path: string,
        public content?: T.Node,
        options?: ModuleOptions
    ) {
        this.filename = options?.filename ?? basename(this.path);
    }
}

export class Graph {
    modules = new Map<string, Module>;
    injections = new Array<Injection>;

    addModule(path: string, content?: T.Node, options?: ModuleOptions) {
        path = toPosix(path);

        const module = new Module(path, content, options);

        this.modules.set(path, module);

        return module;
    }

    getModule(path: string) {
        path = toPosix(path);
        
        return this.modules.get(path);
    }

    addInject(id: string, module: Module) {
        this.injections.push(
            new Injection(id, module)
        );
    }

    async build() {
        for(const module of this.modules.values()) {
            const outPath = module.path
                .replace(this.config.entryPath, this.config.buildPath)
                .replace(/\.(t|j)sx?$/, '.js');

            if(module.content) {
                const content = generate(module.content).code;
                
                await fs.writeFile(outPath, content, { recursive: true });
            }
        }
    }

    constructor(public config: Config) {}
}

export default Graph;