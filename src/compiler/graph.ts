import * as T from '@babel/types';
import fs from 'fs/promises';
import Config from '../config';
import _generate from '@babel/generator';
import { Module } from "./module";
import { REGEX } from '../consts';
import { join } from 'path';

const generate: typeof _generate = typeof _generate == 'object'
    ? (_generate as any).default
    : _generate;

class Injection {
    readonly id: T.Identifier;
    
    constructor(
        id: string | T.Identifier,
        public module: Module
    ) {
		if(T.isNode(id) && T.isIdentifier(id)) {
			this.id = id;	
		}
		else {
			this.id = T.identifier(id);
		}
    }
}

// TODO: registrar os symbols 
export class Graph {
    modules = new Map<string, Module>;
    injections = new Array<Injection>;

    addModule(path: string, content?: T.File | string) {
        path = Module.normalizePath(path);

        const module = new Module(path, content);

        this.modules.set(path, module);

        return module;
    }

    getModule(path: string) {
        path = Module.normalizePath(path);
        
        return this.modules.get(path);
    }

    addInject(id: string, module: Module) {
        this.injections.push(
            new Injection(id, module)
        );
    }

    async build() {
        for(const module of this.modules.values()) {
            if(module.content) {
                const content = generate(module.content, { comments: false }).code;
                
                await fs.writeFile(module.buildPath, content, { recursive: true });
            }
        }
    }

    constructor(public config: Config) {}
}

export default Graph;
