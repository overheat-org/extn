import * as T from '@babel/types'
import { parse } from '@babel/parser';
import _traverse, { NodePath } from '@babel/traverse';
import { CommandModule, Module } from './module';
import Graph from './graph';
import fs from 'fs/promises';
import { REGEX } from '../consts';
import { asyncTraverse, AsyncVisitor, getErrorLocation } from './utils';
import { FlameError } from './reporter';
import Config from '../config';
import { dirname, join } from 'path';
import Transformer from './transformer';
import ImportResolver from './import-resolver';

function ModuleVisitorFactory(parser: Parser, module: Module) {
    const { transformer, importResolver } = parser;

    return {
        async ImportDeclaration(path: NodePath<T.ImportDeclaration>) {
            const absolutePath = await importResolver.resolve(path.node.source.value, module.entryPath);
            if(!absolutePath) return;

            const importedModule = await parser.parseFile(absolutePath);

            if(!path.node) return;
            
            if(
                path.node.specifiers.length == 0 &&
                (REGEX.IS_COMMAND_FILE.test(path.node.source.value) || REGEX.FLAME_MODULE.test(path.node.source.value))
            ) {
                path.remove();
            }
            else {
                transformer.module.transformImportSource(path, importedModule, dirname(module.buildPath));
            }
        },
    
        async Decorator(path: NodePath<T.Decorator>) {
            await transformer.module.transformDecorator(path, module);
        }
    } as AsyncVisitor
}

function CommandVisitorFactory(parser: Parser, module: Module) {
    const { transformer, importResolver } = parser;
    
    return {
        ...ModuleVisitorFactory(parser, module),
        async ImportDeclaration(path: NodePath<T.ImportDeclaration>) {
            const absolutePath = await importResolver.resolve(path.node.source.value, module.entryPath)
            const importedModule = absolutePath ? await parser.parseFile(absolutePath) : undefined;

            if(!path.node) return;
            
            transformer.command.transformImportSource(path, importedModule);
        },
        
        EnumDeclaration(path: NodePath<T.EnumDeclaration>) {
            throw new FlameError('Cannot use enum in command', getErrorLocation(path, module.entryPath));
        },
    
        ClassDeclaration(path: NodePath<T.ClassDeclaration>) {
            throw new FlameError('Cannot use class in command', getErrorLocation(path, module.entryPath));
        },
    
        ExportNamedDeclaration(path: NodePath<T.ExportNamedDeclaration>) {
            const node = path.node;
    
            if (node.specifiers.length == 0) return;
    
            throw new FlameError('Cannot export in command', getErrorLocation(path, module.entryPath));
        },
    
        ExportDefaultDeclaration(path: NodePath<T.ExportDefaultDeclaration>) {
            path.replaceWith(T.returnStatement(path.node.declaration as T.Expression));
        },
    } as AsyncVisitor
}

class Parser {
    importResolver: ImportResolver;

    constructor(public config: Config, private graph: Graph, public transformer: Transformer) {
        this.importResolver = new ImportResolver(config);
    }

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

    async parseFile(filePath: string) {
        filePath = Module.normalizePath(filePath);
        console.log({filePath})

        {
            const module = this.graph.getModule(filePath);
            if(module) return module;
        }

        
        const content = await fs.readFile(filePath, 'utf-8');
        let ast: T.File

        try {
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
        let module: Module | CommandModule;
        let visitor: AsyncVisitor;
        
        if(isCommand) {
            module = new CommandModule(filePath, ast);
            visitor = CommandVisitorFactory(this, module);
            this.graph.addCommand(module);
        }
        else {
            module = new Module(filePath, ast);
            visitor = ModuleVisitorFactory(this, module);
            this.graph.addModule(module);
        }
        
        await asyncTraverse(ast, visitor);

        return module;
    }
}

export default Parser;