import fs from 'fs/promises';
import parser from '@babel/parser';
import _traverse, { TraverseOptions } from '@babel/traverse';
import { transformFromAstAsync as transform } from '@babel/core';
import template from '@babel/template';
import Config from '../config';
import { basename, dirname, extname, join, relative, resolve } from 'path';
import { existsSync } from 'fs';
import ComptimeDecoratorsPlugin from '@meta-oh/comptime-decorators/babel';
import decorators from './decorators';
import { transformImportPath, useErrors } from './utils';
import * as T from '@babel/types';
import ImportManager from './import-manager';

const traverse: typeof _traverse = typeof _traverse == 'object'
	? (_traverse as any).default
	: _traverse;

const EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];

interface ModuleOptions { type?: 'command' | 'default' }

const errors = useErrors({
    CANNOT_USE_CLASS: 'Cannot use class in command',
    CANNOT_EXPORT: 'Cannot export in command',
    CANNOT_USE_ENUM: 'Cannot declare enums in command'
});

class Module {
    dependencies = new Array<Module>;

    async parse() {
        const content = await fs.readFile(this.resolvePath(this.absolutePath), 'utf-8');

        return parser.parse(content, { sourceType: 'module', plugins: ['typescript', 'jsx', 'decorators'] });
    }

    async transform() {
        const { graph, absolutePath, resolvePath } = this;
        const ast = await this.parse();

        const isCommand = this.options.type == 'command';

        let opts: TraverseOptions = {
            ImportDeclaration(path) {
                const node = path.node;

                if(isCommand) {
                    path.get('source').set('value', transformImportPath(
                        absolutePath,
                        'commands.js',
                        node.source.value,
                        graph.config
                    ));

                    const topLevelImport = ImportManager.fromTopLevel(path.node);
                    const dynamicImport = topLevelImport.toDynamic();

                    path.replaceWith(dynamicImport.node);
                }

                if(node.source.value.startsWith('.')) {
                    const path = resolve(dirname(absolutePath), node.source.value);
                    
                    graph.addModule(
                        resolvePath(path)
                    );
                }
            }
        }

        if(isCommand) {
            opts = {
                ...opts,
                ClassDeclaration() {
                },
                ExportNamedDeclaration() {
                },
                TSEnumDeclaration() {
                },
                ExportDefaultDeclaration(path) {
                    path.replaceWith(T.returnStatement(path.node.declaration as T.Expression));
                }
            }
        }

        traverse(ast, opts);
        if(isCommand) this.transformCommand(ast);

        const { code } = (await transform(ast, undefined, {
            presets: ["@babel/preset-typescript"],
            plugins: [ComptimeDecoratorsPlugin(decorators)],
            filename: basename(absolutePath)
        })) ?? {};

        if(isCommand && code) this.graph.command.push(code);
        
        return code;
    }

    transformCommand(ast: parser.ParseResult<T.File>) {
        const buildAsyncWrapper = template.statement(`
            (async () => {
                %%body%%
            })().then(m => __module__ = { ...__module__, ...m });
        `);

        ast.program.body = [buildAsyncWrapper({
            body: ast.program.body,
        })];
    }
    
    resolvePath(basePath: string) {
        if(extname(basePath) != '') return basePath
        
        for (const ext of EXTENSIONS) {
            const fullPath = basePath + ext;
            if (existsSync(fullPath)) {
                return fullPath;
            }
        }

        return basePath;
    }

    constructor(private graph: Graph, public absolutePath: string, public path: string, public options: ModuleOptions = {}) {}
}

class Graph {
    modules = new Map<string, Module>;

    addModule(path: string, options?: ModuleOptions) {
        const absolutePath = path;
        path = relative(this.config.entryPath, path);

        const module = new Module(this, absolutePath, path, options);

        this.modules.set(path, module);
    }

    async build() {
        for(const module of this.modules.values()) {
            const content = await module.transform();
            if(!content) throw new Error("Transformation failed");
            
            const path = module.path.replace(/\.(ts|tsx|jsx)$/, '.js');
            
            await fs.writeFile(join(this.config.buildPath, path), content, { recursive: true });
        }
    }

    constructor(public config: Config) {}
}

export default Graph;