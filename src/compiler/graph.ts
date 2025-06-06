import * as T from '@babel/types';
import fs from 'fs/promises';
import Config from '../config';
import { CommandModule, Module } from "./module";
import Transformer from './transformer';

export class ModuleSymbol {
    readonly id: T.Identifier
    
    constructor(
        public name: string,
        public filePath: string
    ) {
        this.id = T.identifier(name);
    }
}

class Injectable {
    constructor(
        public symbol: ModuleSymbol,
        public dependencies: ModuleSymbol[]
    ) {}
}

// TODO: registrar os symbols 
export class Graph {
    private modulesByEntry = new Map<string, Module>;
    modules = new Set<Module>;
    injectables = new Set<Injectable>;
    commands = new Array<CommandModule>;

    addModule(module: Module): Module
    addModule(path: string, content?: T.File): Module
    addModule(...args: unknown[]) {
        let module: Module;
        
        if(typeof args[0] == 'string') {
            const [path, content] = args as [string, T.File | undefined];

            module = new Module(path, content); 
        }
        else {
            module = args[0] as Module;
        }

        if(module.entryPath) this.modulesByEntry.set(module.entryPath, module);
        this.modules.add(module);

        return module;
    }
    
    removeModule(module: Module): boolean;
    removeModule(path: string): boolean;
    removeModule(arg: string | Module): boolean {
        let path: string;
        let target: Module;
    
        if (typeof arg === "string") {
            path = Module.normalizePath(arg);
            target = this.modulesByEntry.get(path)!;
        } else {
            path = arg.entryPath;
            target = arg;
        }
    
        const removedMap = this.modulesByEntry.delete(path);
        const removedSet = this.modules.delete(target);
    
        return removedMap || removedSet;
    }
    
    getModule(path: string) {
        path = Module.normalizePath(path);
        
        return this.modulesByEntry.get(path);
    }

    addCommand(module: CommandModule): CommandModule
    addCommand(path: string, content?: T.File): CommandModule
    addCommand(...args: unknown[]) {
        let module: CommandModule;
        
        if(typeof args[0] == 'string') {
            const [path, content] = args as [string, T.File | undefined];

            module = new CommandModule(path, content); 
        } else {
            module = args[0] as CommandModule;
        }
        
        this.commands.push(module);

        return module;
    }

    addInjectable(id: string | T.Identifier, module: Module, dependencies: ModuleSymbol[]) {
        this.injectables.add(
            new Injectable(id, module, dependencies)
        );
    }
}

export default Graph;
