import * as T from '@babel/types'
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { CommandModule, Module, NodeModule } from './module';
import Graph from './graph';
import fs from 'fs/promises';
import { REGEX } from '../consts';
import { FlameError } from './reporter';
import { join } from 'path';
import Transformer from './transformer';
import ImportResolver from './import-resolver';

class Parser {
    constructor(private graph: Graph, public transformer: Transformer, public importResolver: ImportResolver) {}

    async parseDir(path: string) {
        for(const dirent of await fs.readdir(path, { withFileTypes: true }).catch(() => [])) {
            if(dirent.isFile()) {
                await this.parseFile(join(path, dirent.name));
            }
            else {
                await this.parseDir(join(path, dirent.name));
            }
        }
    }

    async parsePath(path) {
        path = Module.normalizePath(path);

        if(path.includes('node_modules')) {
            const module = NodeModule.from(path);
            this.graph.addModule(module);
            return module;
        }
        else {
            return this.parseFile(path);
        }
    }

    async parseFile(filePath: string) {
        filePath = Module.normalizePath(filePath);

        {
            const module = this.graph.getModule(filePath);
            if(module) return module;
        }
        
        let ast: T.File
        try {
            const content = await fs.readFile(filePath, 'utf-8');

            const result = parse(content, { 
                sourceType: 'module',
                plugins: ["decorators", "typescript", "jsx"],
                errorRecovery: true
            });

            if((result.errors ?? []).length > 0) {
                throw result.errors;
            }

            ast = result;
        } catch(e) {
            throw new FlameError(`Error on file parser: \n${e}`, { path: filePath })
        }
        
        const isCommand = REGEX.IS_COMMAND.test(filePath);
        const module = isCommand
            ? this.graph.getCommand(filePath) ?? CommandModule.from(filePath, ast)
            : this.graph.getModule(filePath) ?? Module.from(filePath, ast);

        if (isCommand) this.graph.addCommand(module);
        else this.graph.addModule(module);

        await this.parseDependencies(module);

        return module;
    }

    private async parseDependencies(module: Module) {
        module.content.program.body.forEach(async n => {
            if(!T.isImportDeclaration(n)) return;
            if(!n.source || !T.isStringLiteral(n.source)) return;

            const resolved = await this.importResolver.resolve(n.source.value, module.entryPath);
            if (!resolved) return;

            await this.parsePath(resolved);
        });
    }
}

export default Parser;