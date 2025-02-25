import fs from 'fs/promises';
import { basename, dirname, relative, resolve } from 'path';
import * as T from '@babel/types';
import { PluginItem, template, transformAsync } from '@babel/core';
import { NodePath, Visitor } from "@babel/traverse";
import ComptimeDecoratorsPlugin from '@meta-oh/comptime-decorators/babel';
import decorators from './decorators';
import Graph from './graph';
import Config from '../config';
import { findNodeModulesDir, FlameError, resolvePath, toDynamicImport, toPosix, transformImportPath, useErrors } from './utils';
import { join as j } from 'path/posix';
import { FLAME_MANAGER_REGEX, SUPPORTED_EXTENSIONS_REGEX } from '../consts';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { default as ReplacerPlugin, replacement } from '@meta-oh/replacer/babel';
import { parseExpression } from '@babel/parser';
import { getEnvFile } from './env';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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
        ["@babel/preset-react", { runtime: "automatic", importSource: "diseact" }]
    ];

    protected getVisitor(filepath: string): Visitor {
        return {
            ImportDeclaration: p => this.transformImportDeclaration(p, filepath)
        };
    }

    async transformFile(path: string, { visitor, ...opts }: { code?: boolean, ast?: boolean, visitor?: Visitor } = { ast: true }) {
        path = resolvePath(path);

        let content = await fs.readFile(path, 'utf-8');

        const visitorPlugin = { visitor: visitor ?? this.getVisitor(path) };

        const result = await transformAsync(content, {
            ...opts,
            plugins: [...this.plugins, visitorPlugin],
            presets: this.presets,
            filename: path
        });

        if(!result) throw new Error("Transformation failed");

        return result;
    }

    async transformModule(path: string) {
        path = resolvePath(path);

        const module = this.graph.addModule(path);
        const result = await this.transformFile(path);

        module.content = result.ast ?? undefined;
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

    async transformDir(dirpath: string) {
        const dirents = await fs.readdir(dirpath, { withFileTypes: true });

        for (const dirent of dirents) {
            const path = j(dirent.parentPath ?? dirpath, dirent.name);

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

        let body = new Array<T.Statement>;

        const buildAsyncWrapper = template.statement(`
            (async () => {
                %%body%%
            })().then(m => __module__ = { ...__module__, ...m.__map__ });
        `);

        for(const command of commands) {
            body.push(buildAsyncWrapper({
                body: command.program.body,
            }))
        }

        body.unshift(
            T.variableDeclaration(
                "let",
                [
                    T.variableDeclarator(
                        T.identifier("__module__"),
                        T.objectExpression([])
                    )
                ]
            )
        );

        body.push(
            T.exportDefaultDeclaration(
                T.identifier("__module__")
            )
        );


        this.graph.addModule(path + '.js', T.program(body));
    }

    async transformDir(dirpath: string) {
        const dirents = await fs.readdir(dirpath, { withFileTypes: true });
        const files = new Array<T.File>;

        for (const dirent of dirents) {
            const path = j(dirent.parentPath ?? dirpath, dirent.name);

            if (dirent.isFile()) files.push((await this.transformFile(path)).ast!);
            else files.push(...await this.transformDir(path));
        }

        return files;
    }
    
    protected transformImportDeclaration(path: NodePath<T.ImportDeclaration>, filepath: string) {
        let importPath = path.get('source').node.value;

        if (importPath.startsWith('..')) {
            const currentBuildFile = basename(toPosix(relative(this.config.entryPath, filepath)));

            const finalImportPath = transformImportPath(
                filepath,
                currentBuildFile,
                importPath,
                this.config
            ).replace(SUPPORTED_EXTENSIONS_REGEX, '.js');
        
            path.get('source').set('value', finalImportPath);
        }
    
        toDynamicImport(path);
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

        const locStart = node.loc?.start!;
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
    plugins: PluginItem[] = [
        ReplacerPlugin()
    ];
    
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
        ]);
        await this.emitIndex(this.config.entryPath);
    }

    private async emitIndex(path: string) {
        const imports = this.graph.injections.map(i => {
			let modPath = toPosix(relative(path, i.module.path))
				.replace(SUPPORTED_EXTENSIONS_REGEX, '.js');

			if(!modPath.startsWith('.')) {
				modPath = './' + modPath;
			}
			
			const decl = (
				T.importDeclaration([
					T.importSpecifier(
						i.id,
						i.id
					)
				], T.stringLiteral(modPath))
			)
			
			return decl;
		});

        const instances = this.graph.injections.map(i => (
            T.expressionStatement(
                T.newExpression(i.id, [T.identifier('client')])
            )
        ));

        replacement.set("MANAGERS", [...imports, ...instances]);
		
		const EnvWrapper = template(`
			process.env = {
				...process.env,
				...%%ENV%%
			}	
		`);
		
		replacement.set("ENV", [EnvWrapper({ 
			ENV: JSON.stringify(getEnvFile(this.config.cwd))
		})] as T.Statement[]);

		replacement.set('INTENTS', [
			T.variableDeclaration('const', [
				T.variableDeclarator(
					T.identifier('intents'),
					parseExpression(typeof this.config.intents == 'string' 
						? this.config.intents 
						: JSON.stringify(this.config.intents)
					)
				)
			])
		]);

        const result = await this.transformFile(
			j(__dirname, 'static', 'client.template.js'), 
			{
				ast: true,
				visitor: {}
			}
		);

		const ast = result.ast ?? undefined;

        this.graph.addModule(j(path, 'index.js'), ast);
    }
}

export default Transformer;