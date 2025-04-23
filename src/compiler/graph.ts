import * as T from '@babel/types';
import fs from 'fs/promises';
import Config from '../config';
import { CommandModule, Module } from "./module";
import Transformer from './transformer';

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
    private modulesByEntry = new Map<string, Module>;
    modules = new Set<Module>;
    injections = new Array<Injection>;
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

    addInjection(id: string, module: Module) {
        this.injections.push(
            new Injection(id, module)
        );
    }
}

export default Graph;
