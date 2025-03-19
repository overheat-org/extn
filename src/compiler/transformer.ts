import fs from 'fs/promises';
import { basename, dirname, join, posix, relative } from 'path';
import * as T from '@babel/types';
import { PluginItem, template, transformAsync } from '@babel/core';
import { NodePath, Visitor } from "@babel/traverse";
import ComptimeDecoratorsPlugin from '@meta-oh/comptime-decorators/babel';
import decorators from './decorators';
import Graph from './graph';
import Config from '../config';
import { findNodeModulesDir, toDynamicImport } from './utils';
import { join as j } from 'path/posix';
import { FLAME_MANAGER_REGEX, SUPPORTED_EXTENSIONS_REGEX } from '../consts';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { default as ReplacerPlugin, replacement } from '@meta-oh/replacer/babel';
import { parseExpression } from '@babel/parser';
import { getEnvFile } from './env';
import { Module } from './module';
import { readFileSync } from 'fs';
import type { CompilerOptions } from "typescript";
import { FlameError } from './reporter';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const isRootPath = (path: string) => /^\.?\/?[^/]+$/.test(path);

type TsConfig = { compilerOptions: CompilerOptions }

class BaseTransformer {
	tsconfig?: TsConfig;

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
		path = Module.normalizePath(path);

		let content = await fs.readFile(path, 'utf-8');

		const visitorPlugin = { visitor: visitor ?? this.getVisitor(path) };

		const result = await transformAsync(content, {
			...opts,
			plugins: [...this.plugins, visitorPlugin],
			presets: this.presets,
			filename: path
		});

		if (!result) throw new Error("Transformation failed");

		return result;
	}

	async transformModule(path: string, dirpath?: string) {
		path = Module.normalizePath(path);

		const module = this.graph.addModule(path);
		const result = await this.transformFile(path);

		module.content = result.ast ?? undefined;

		const replaceArgs = [/\.(t|j)sx?$/, '.js'] as const;

		if (dirpath) {
			return Module.normalizePath(
				Module
					.pathToRelative(path, dirpath)
					.replace(...replaceArgs)
			)
		}
		else {
			return path.replace(...replaceArgs);
		}
	}

	resolveImportAlias(path: string) {
		const { baseUrl, paths } = this.tsconfig?.compilerOptions ?? {};
		if (!paths) return;

		const basePath = j(this.config.cwd, baseUrl || '');

		for (const alias in paths) {
			const targets = paths[alias];
			if (!Array.isArray(targets) || !targets.length) continue;

			let regex: RegExp | null = null;
			let match: RegExpMatchArray | null = null;
			
			if (alias.includes('*')) {
				const pattern = '^' + alias.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '(.*)') + '$';
				regex = new RegExp(pattern);
				match = path.match(regex);
				if (!match) continue;
			} else if (!path.startsWith(alias)) {
				continue;
			}

			for (const target of targets) {
				const targetPath = alias.includes('*')
					? target.replace('*', match![1])
					: target;

				const candidate = Module.resolvePath(j(basePath, targetPath));
				if (candidate) return candidate;
			}
		}
	}

	protected async transformImportDeclaration(path: NodePath<T.ImportDeclaration>, filepath: string) {
		const dirpath = dirname(filepath);
		const source = path.node.source.value;

		let absolutePath: string | undefined;
		{
			if(source.startsWith('.')) {
				absolutePath = Module.resolvePath(source, dirpath)!;
			}
			else {
				console.log('NOT RELATIVE')
				absolutePath = this.resolveImportAlias(source);
			}
		}
		
		// FIXME: me a error here
		if(!absolutePath) return;

		const relativePath = await this.transformModule(absolutePath, dirpath);

		path.get('source').set('value', relativePath);
	}

	constructor(protected graph: Graph, protected config: Config) {
		// FIXME: if tsconfig not exists, this will throw an error
		this.tsconfig = JSON.parse(
			readFileSync(j(config.cwd, "tsconfig.json"), "utf8")
		);
	}
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

	async transformExternDir(dirpath: string) {
		const dirents = await fs.readdir(dirpath, { withFileTypes: true });

		for (const dirent of dirents) {
			const path = j(dirent.parentPath ?? dirpath, dirent.name);

			if (!FLAME_MANAGER_REGEX.test(path)) continue;

			const name = dirent.name.split('-').slice(1).join('-');

			try {
				const { main } = JSON.parse(await fs.readFile(j(path, 'package.json'), 'utf-8'));

				if (!isRootPath(main)) {
					await glob(j(path, '/**/command.{ts,js,tsx,jsx}')).then(async paths => {
						for (const p of paths) await this.parent.command.transformModule(p);
					});
				} else {
					await this.transformModule(j(path, main));
				}

			} catch (e: any) {
				if (e.code == 'ENOENT') {
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

		for (const command of commands) {
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

	protected async transformImportDeclaration(path: NodePath<T.ImportDeclaration>, filepath: string) {
		let importPath = path.get('source').node.value;

		if (importPath.startsWith('.')) {
			const currentBuildFile = basename(Module.pathToRelative(filepath, this.config.entryPath));
			const absImport = Module.resolvePath(importPath, dirname(filepath))!;
			const relToEntry = relative(this.config.entryPath, absImport);
			const builtImport = join(this.config.buildPath, relToEntry);
			let relFromNewSelf = relative(dirname(join(this.config.buildPath, currentBuildFile)), builtImport);
			relFromNewSelf = Module.normalizePath(relFromNewSelf);

			if (!relFromNewSelf.startsWith('.')) {
				relFromNewSelf = '.' + posix.sep + relFromNewSelf;
			}
			const finalImportPath = relFromNewSelf.replace(SUPPORTED_EXTENSIONS_REGEX, '.js');

			path.get('source').set('value', finalImportPath);
		}

		toDynamicImport(path);
	}


	private transformEnumDeclaration(path: NodePath<T.EnumDeclaration>, filepath: string) {
		const locations = path.node.loc?.start! ?? {};

		throw new FlameError('Cannot use enum in command', { path: filepath, ...locations });
	}

	private transformClassDeclaration(path: NodePath<T.ClassDeclaration>, filepath: string) {
		const locations = path.node.loc?.start! ?? {};

		throw new FlameError('Cannot use class in command', { path: filepath, ...locations });
	}

	private transformExportNamedDeclaration(path: NodePath<T.ExportNamedDeclaration>, filepath: string) {
		const node = path.node;

		if (node.specifiers.length == 0) return;

		const locations = node.loc?.start! ?? {};
		throw new FlameError('Cannot export in command', { path: filepath, ...locations });
	}

	private transformExportDefaultDeclaration(path: NodePath<T.ExportDefaultDeclaration>) {
		path.replaceWith(T.returnStatement(path.node.declaration as T.Expression));
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

		console.log({flamePath})

		await Promise.all([
			this.manager.transformDir(j(this.config.entryPath, 'managers')),
			this.command.mergeDir(j(this.config.entryPath, 'commands')),
			this.manager.transformExternDir(flamePath)
		]);
		await this.emitIndex(this.config.entryPath);
	}

	private async emitIndex(path: string) {
		const imports = this.graph.injections.map(i => {
			const modPath = Module.toBuildPath(i.module.path, path);

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
