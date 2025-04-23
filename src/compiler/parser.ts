import * as T from '@babel/types'
import { parse, ParseResult } from '@babel/parser';
import _traverse, { NodePath, Visitor } from '@babel/traverse';
import { CommandModule, Module } from './module';
import Graph from './graph';
import fs from 'fs/promises';
import { REGEX } from '../consts';
import { getErrorLocation } from './utils';
import { FlameError } from './reporter';
import Config from '../config';
import { dirname, join } from 'path';
import Transformer from './transformer';
import ImportResolver from './import-resolver';

const traverse: typeof _traverse = typeof _traverse == 'object'
    ? (_traverse as any).default
    : _traverse;

function ModuleVisitorFactory(parser: Parser, module: Module) {
    const { transformer, importResolver } = parser;

    return {
        ImportDeclaration(path: NodePath<T.ImportDeclaration>) {
            importResolver.resolve(path.node.source.value, module.entryPath).then(async absolutePath => {
                if(!absolutePath) return;

                const importedModule = await parser.parseFile(absolutePath);
                
                transformer.module.transformImportSource(path, importedModule, dirname(module.buildPath));
            });
        },
    
        Decorator(path: NodePath<T.Decorator>) {
            transformer.module.transformDecorator(path, module);
        }
    } as Visitor
}

function CommandVisitorFactory(parser: Parser, module: Module) {
    const { transformer, importResolver } = parser;
    
    return {
        ...ModuleVisitorFactory(parser, module),
        ImportDeclaration(path: NodePath<T.ImportDeclaration>) {
            importResolver.resolve(path.node.source.value, module.entryPath).then(async absolutePath => {
                if(!absolutePath) return;
    
                const importedModule = await parser.parseFile(absolutePath);

                transformer.command.transformImportSource(path, importedModule);
            });
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
    } as Visitor
}

class Parser {
    importResolver: ImportResolver;

    constructor(public config: Config, private graph: Graph, public transformer: Transformer) {
        this.importResolver = new ImportResolver(config);
    }

    async parseDir(path: string) {
        void 0;
        
        for(const dirent of await fs.readdir(path, { withFileTypes: true })) {
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
        
        const content = await fs.readFile(filePath, 'utf-8');
        let ast: ParseResult<T.File>

        try {
            ast = parse(content, { 
                sourceType: 'module',
                plugins: ["decorators", "typescript", "jsx"]
            });
        } catch(e) {
            throw new FlameError(`Error on file parser: \n${e}`, { path: filePath })
        }
        
        const isCommand = REGEX.IS_COMMAND.test(filePath);
        const VisitorFactory = isCommand ? CommandVisitorFactory : ModuleVisitorFactory;
        const _Module = isCommand ? CommandModule : Module;

        const module = new _Module(filePath, ast);
        const visitor = VisitorFactory(this, module);
        
        traverse(ast, visitor);

        if(isCommand) this.graph.addCommand(module);
        else this.graph.addModule(module);

        return module;
    }
}

export default Parser;