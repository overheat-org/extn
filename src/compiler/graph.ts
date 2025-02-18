import fs from 'fs/promises';
import { basename } from 'path';
import Config from '../config';
import { toPosix } from './utils';

interface ModuleOptions { filename?: string }

class Injection {
    constructor(
        public id: string,
        public module: Module
    ) {}
}

export class Module implements ModuleOptions {
    public filename: string;
    
    constructor(
        public path: string,
        public content: string,
        options?: ModuleOptions
    ) {
        this.filename = options?.filename ?? basename(this.path);
    }
}

export class Graph {
    modules = new Map<string, Module>;
    injections = new Array<Injection>;

    addModule(path: string, content?: string, options?: ModuleOptions) {
        path = toPosix(path);

        const module = new Module(path, content ?? "", options);

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

    async build(config: Config) {
        for(const module of this.modules.values()) {
            const outPath = module.path
                .replace(config.entryPath, config.buildPath)
                .replace(/\.(t|j)sx?$/, '.js');
            
            await fs.writeFile(outPath, module.content, { recursive: true })
        }
    }

    // constructor(public config: Config) {}
}

export default Graph;