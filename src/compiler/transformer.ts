import fs from 'fs/promises';
import { basename, dirname, relative, resolve } from 'path';
import * as T from '@babel/types';
import { PluginItem, transformAsync } from '@babel/core';
import { NodePath, Visitor } from "@babel/traverse";
import _generate from '@babel/generator';
import ComptimeDecoratorsPlugin from '@meta-oh/comptime-decorators/babel';
import decorators from './decorators';
import Graph from './graph';
import Config from '../config';
import ImportManager from './import-manager';
import { findNodeModulesDir, FlameError, resolvePath, toPosix, transformImportPath, useErrors } from './utils';
import { join as j } from 'path/posix';
import { FLAME_MANAGER_REGEX } from '../consts';
import { glob } from 'glob';

const generate: typeof _generate = typeof _generate == 'object'
	? (_generate as any).default
	: _generate;

const isRootPath = (path: string) => /^\.?\/?[^/]+$/.test(path);

const errors = useErrors({
    CANNOT_USE_CLASS: 'Cannot use class in command',
    CANNOT_EXPORT: 'Cannot export in command',
    CANNOT_USE_ENUM: 'Cannot declare enums in command'
});

class BaseTransformer {
    plugins: PluginItem[] = [];
    presets: PluginItem[] = [
        "@babel/preset-typescript",
        "@babel/preset-react"
    ];

    protected getVisitor(filepath: string): Visitor {
        return {
            ImportDeclaration: p => this.transformImportDeclaration(p, filepath)
        };
    }

    async transformFile(path: string, opts: { code?: boolean, ast?: boolean } = { code: true }) {
        path = resolvePath(path);

        let content = await fs.readFile(path, 'utf-8');

        this.plugins.push({ visitor: this.getVisitor(path) });

        const result = await transformAsync(content, {
            ...opts,
            plugins: this.plugins,
            presets: this.presets,
            filename: basename(path)
        });

        if (!result || !result.code) {
            throw new Error("");
        };

        return result;
    }

    async transformModule(path: string) {
        path = resolvePath(path);

        const result = await this.transformFile(path);
        const module = this.graph.addModule(path);

        module.content = result.code!;
    }

    protected transformImportDeclaration(path: NodePath<T.ImportDeclaration>, filepath: string) {
        const source = path.node.source.value;

        if (source.startsWith('.')) {
            const absolutePath = resolvePath(resolve(dirname(filepath), source));

            this.transformModule(absolutePath);

            const relativePath = toPosix(relative(dirname(filepath), absolutePath)).replace(/\.(t|j)sx?$/, '.js');

            path.get('source').set('value', relativePath);
        }
    }

    constructor(protected graph: Graph, protected config: Config) { }
}

class ManagerTransformer extends BaseTransformer {
    OUT_DIR: string;
    parent!: Transformer;

    async transformDir(path: string) {
        const dirents = await fs.readdir(path, { withFileTypes: true });

        for (const dirent of dirents) {
            const path = j(dirent.parentPath, dirent.name);

            if (dirent.isFile()) await this.transformModule(path);
            else await this.transformDir(path);
        }
    }

    async transformExternDir(path: string) {
        const dirents = await fs.readdir(path, { withFileTypes: true });

        for (const dirent of dirents) {
            const path = j(dirent.parentPath, dirent.name);

            if (!FLAME_MANAGER_REGEX.test(path)) continue;

            const name = dirent.name.split('-')[1];

            try {
                const { main } = JSON.parse(await fs.readFile(j(path, 'package.json'), 'utf-8'));

                if (!isRootPath(main)) {
                    await glob(j(path, '/**/command.{ts,js,tsx,jsx}')).then(async paths => {
                        for (const p of paths) await this.parent.command.transformModule(p);
                    });
                } else {
                    await this.transformModule(j(path, main));
                }

            } catch(e: any) {
                if(e.code == 'ENOENT') {
                    throw new Error(`Cannot find package.json of extern manager '${name}'.`);
                }

                throw e;
            }
        }
    }

    constructor(graph: Graph, config: Config) {
        super(graph, config);

        this.plugins = [
            ComptimeDecoratorsPlugin(decorators, graph)
        ]

        this.OUT_DIR = j(config.buildPath, 'managers');
    }
}

class CommandTransformer extends BaseTransformer {
    parent!: Transformer

    protected getVisitor(filepath: string): Visitor {
        return {
            ...super.getVisitor(filepath),
            EnumDeclaration: p => this.transformEnumDeclaration(p, filepath),
            ClassDeclaration: p => this.transformClassDeclaration(p, filepath),
            ExportNamedDeclaration: p => this.transformExportNamedDeclaration(p, filepath),
            ExportDefaultDeclaration: this.transformExportDefaultDeclaration
        };
    }

    async mergeDir(path: string) {
        const commands = await this.transformDir(path);

        const body = new Array<T.Statement>;

        for(const command of commands) {
            body.push(...command.program.body);
        }

        const { code } = generate(T.program(body));

        this.graph.addModule(path + '.js', code);
    }

    async transformDir(path: string) {
        const dirents = await fs.readdir(path, { withFileTypes: true });
        const files = new Array<T.File>;

        for (const dirent of dirents) {
            const path = j(dirent.parentPath, dirent.name);

            if (dirent.isFile()) files.push((await this.transformFile(path, { ast: true })).ast!);
            else files.push(...await this.transformDir(path));
        }

        return files;
    }
    
    protected transformImportDeclaration(path: NodePath<T.ImportDeclaration>, filepath: string) {
        const source = path.get('source').node.value;
        
        if (source.startsWith('..')) {
            const absolutePath = resolvePath(resolve(dirname(filepath), source));

            this.parent.transformModule(absolutePath);

            const relativePath = toPosix(relative(dirname(filepath), absolutePath)).replace(/\.(t|j)sx?$/, '.js');

            path.get('source').set('value', relativePath);
        }
        
        const node = path.node;

        path.get('source').set('value', transformImportPath(
            filepath,
            'commands.js',
            node.source.value,
            this.config
        ));

        const topLevelImport = ImportManager.fromTopLevel(node);
        const dynamicImport = topLevelImport.toDynamic();

        path.replaceWith(dynamicImport.node);
    }

    private transformEnumDeclaration(path: NodePath<T.EnumDeclaration>, filepath: string) {
        throw errors.CANNOT_USE_ENUM;
    }

    private transformClassDeclaration(path: NodePath<T.ClassDeclaration>, filepath: string) {
        const node = path.node;

        const locStart = node.loc?.start!;
        throw new FlameError('Cannot use class in command', { path: filepath, ...locStart });
    }

    private transformExportNamedDeclaration(path: NodePath<T.ExportNamedDeclaration>, filepath: string) {
        const node = path.node;

        if(node.specifiers.length == 0) return;

        const locStart = node.loc?.start ?? {} as T.s;
        throw new FlameError('Cannot export in command', { path: filepath, ...locStart });
    }

    private transformExportDefaultDeclaration(path: NodePath<T.ExportDefaultDeclaration>) {
        path.replaceWith(T.returnStatement(path.node.declaration as T.Expression));
    }

    constructor(graph: Graph, config: Config) {
        super(graph, config);
    }
}

class Transformer extends BaseTransformer {
    manager: ManagerTransformer;
    command: CommandTransformer;

    constructor(graph: Graph, config: Config) {
        super(graph, config);

        this.manager = new ManagerTransformer(graph, config);
        this.manager.parent = this;
        this.command = new CommandTransformer(graph, config);
        this.command.parent = this;
    }

    async run() {
        const flamePath = findNodeModulesDir(this.config.cwd, '@flame-oh');

        await Promise.all([
            this.manager.transformDir(j(this.config.entryPath, 'managers')),
            this.command.mergeDir(j(this.config.entryPath, 'commands')),
            // this.manager.transformExternDir(flamePath)
            this.emitIndex(this.config.entryPath)
        ]);
    }

    private async emitIndex(path: string) {


        // this.graph.addModule(j(path, 'index.js'), content);
    }
}

export default Transformer;