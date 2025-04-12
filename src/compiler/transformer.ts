import fs from 'fs/promises';
import { basename, dirname, join, posix, relative, resolve, sep } from 'path';
import * as T from '@babel/types';
import { PluginItem, template, transformAsync } from '@babel/core';
import { NodePath, Visitor } from "@babel/traverse";
import ComptimeDecoratorsPlugin from '@meta-oh/comptime-decorators/babel';
import decorators from './decorators';
import Graph from './graph';
import Config from '../config';
import { findNodeModulesDir, getErrorLocation, toDynamicImport } from './utils';
import { join as j } from 'path/posix';
import { FLAME_MODULE, SUPPORTED_EXTENSIONS } from '../consts/regex';
import { glob } from 'glob';
import { fileURLToPath, pathToFileURL } from 'url';
import { default as ReplacerPlugin, replacement } from '@meta-oh/replacer/babel';
import { parseExpression } from '@babel/parser';
import { getEnvFile } from './env';
import { Module } from './module';
import { readFileSync } from 'fs';
import type { CompilerOptions } from "typescript";
import { FlameError } from './reporter';
import { jsonc as JSONC } from 'jsonc';
import { REGEX } from '../consts';

const __dirname = fileURLToPath(new URL(/* @vite-ignore */'.', import.meta.url));

const isRootPath = (path: string) => /^\.?\/?[^/]+$/.test(path);

type TsConfig = { compilerOptions: CompilerOptions }

class BaseTransformer {
	tsconfig?: TsConfig;

	plugins: PluginItem[] = [];
	presets: PluginItem[] = [
		"@babel/preset-typescript",
	];

	protected getVisitor(filepath: string): Visitor {
		return {
			ImportDeclaration: p => this.transformImportDeclaration(p, filepath)
		};
	}

	async transformFile(path: string, { visitor, ...opts }: { visitor?: Visitor } = {}) {
		path = Module.normalizePath(path);

		let content = await fs.readFile(path, 'utf-8');

		const visitorPlugin = { visitor: visitor ?? this.getVisitor(path), ast: true };

		const result = await transformAsync(content, {
			...opts,
			plugins: [...this.plugins, visitorPlugin],
			presets: this.presets,
			filename: path
		});

		if (!result) throw new Error("Transformation failed");

		return result;
	}

	async transformModule(module: Module) {
		const result = await this.transformFile(module.entryPath);

		module.content = result.ast ?? undefined;

		return module;
	}

	protected resolveImportAlias(path: string) {
		const ERR = new FlameError(`Import alias for path "${path}" could not be resolved.`);

		const { baseUrl, paths } = this.tsconfig?.compilerOptions ?? {};
		if (!paths) throw ERR;

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

		throw ERR;
	}

	protected async resolveFlameModuleImport(path: string) {
		const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh');
		const nodeModules = dirname(flameDir);
		const targetPath = nodeModules + sep + path;
		const absolutePath = Module.resolvePath(targetPath);

		const commandsPaths = await glob('**/command.*');
		CommandTransformer.queueProcess(commandsPaths);
		
		return absolutePath!;
	}

	protected resolveRelativeImport(source: string, filepath: string) {
		const dirpath = dirname(filepath);
		return Module.resolvePath(source, dirpath)!;
	}

	protected async resolveImportPath(path: NodePath<T.ImportDeclaration>, filepath: string): Promise<string> {
		const source = path.node.source.value;
	
		let module: Module | undefined;
		if (source.startsWith('.')) {
			const path = this.resolveRelativeImport(source, filepath);
			module = this.graph.addModule(path);
		} else {
			let path: string;
			if(REGEX.FLAME_MODULE.test(source)) path = await this.resolveFlameModuleImport(source);
			else path = this.resolveImportAlias(source);
			module = this.graph.addModule(path);
		}
	
		if (!module) {
			throw new FlameError('Cannot resolve import declaration', { path: filepath, ...getErrorLocation(path) });
		}
	
		await this.transformModule(module);
		return module.buildPath;
	}
	
	protected async transformImportDeclaration(path: NodePath<T.ImportDeclaration>, filepath: string) {
		const absolutePath = await this.resolveImportPath(path, filepath);
		const dirpath = dirname(filepath);
	
		const relativePath = Module.pathToRelative(absolutePath, dirpath);
	
		path.get('source').set('value', relativePath);
	}
	
	constructor(protected graph: Graph, protected config: Config) {
		try {
			this.tsconfig = JSONC.parse(
				readFileSync(j(config.cwd, "tsconfig.json"), "utf8")
			);
		} catch {
			throw new FlameError('Cannot find tsconfig.json of your project');
		}
	}
}

class ManagerTransformer extends BaseTransformer {
	parent!: Transformer;

	async transformDir(dirpath: string) {
		const dirents = await fs.readdir(dirpath, { withFileTypes: true });

		for (const dirent of dirents) {
			const path = j(dirent.parentPath ?? dirpath, dirent.name);

			if (dirent.isFile()) {
				const module = this.graph.addModule(path);
				await this.transformModule(module);
			}
			else await this.transformDir(path);
		}
	}

	constructor(graph: Graph, config: Config) {
		super(graph, config);

		this.plugins = [
			ComptimeDecoratorsPlugin(decorators, graph)
		]
	}
}

class CommandTransformer extends BaseTransformer {
	private static files = new Array<Module>;
	static queueProcess(paths: string[]) {
		
	}
	
	parent!: Transformer
	presets = [
		["@babel/preset-react", { pragma: "jsx", pragmaFrag: "Fragment" }]
	];

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
		await this.transformDir(path);

		const body = template.statements(`
			import { jsx, Fragment } from 'diseact';
			import { CommandMap } from '@flame-oh/core/internal';

			const __map__ = new CommandMap();

			${CommandTransformer.files.map(
				m => template.statement(`
					__map__.register(async () => {
						%%body%%
					});
				`)({ 
					body: m.content!.program.body
				})
			)}

			export default __map__;
		`)();

		this.graph.addModule(path + '.js', T.file(T.program(body)));
	}

	async transformDir(dirpath: string) {
		const dirents = await fs.readdir(dirpath, { withFileTypes: true });

		for (const dirent of dirents) {
			const path = j(dirent.parentPath ?? dirpath, dirent.name);

			if (dirent.isFile()) {
				const module = this.graph.addModule(path);
				CommandTransformer.files.push(await this.transformModule(module))
			}
			else await this.transformDir(path)
		}
	}

	// TODO: refazer isso tendo como base o BaseTransformer.transformImportDeclaration
	// E adicionar uma nova checagem para corrigir corretamente os paths de comandos externos por diretório.
	// passar o buildPath para dentro do modulo também.
	// protected resolveRelativeImport(source: string, filepath: string) {
	// 	const currentBuildFile = basename(Module.pathToRelative(filepath, this.config.entryPath));
	// 	const absImport = Module.resolvePath(source, dirname(filepath))!;
	// 	const relToEntry = relative(this.config.entryPath, absImport);
	// 	const builtImport = join(this.config.buildPath, relToEntry);
	// 	let relFromNewSelf = relative(dirname(join(this.config.buildPath, currentBuildFile)), builtImport);
	// 	relFromNewSelf = Module.normalizePath(relFromNewSelf);

	// 	if (!relFromNewSelf.startsWith('.')) {
	// 		relFromNewSelf = '.' + posix.sep + relFromNewSelf;
	// 	}
	// 	const finalImportPath = relFromNewSelf.replace(SUPPORTED_EXTENSIONS, '.js');

	// 	return finalImportPath;
	// }

	protected async transformImportDeclaration(path: NodePath<T.ImportDeclaration>, filepath: string) {
		const absolutePath = await this.resolveImportPath(path, filepath);	
		const relativePath = Module.pathToRelative(absolutePath, this.config.buildPath);
	
		path.get('source').set('value', relativePath);
		
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

// TODO: mover o run e o emitIndex para o ./index.ts (compiler)
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
		console.log('RUNNING MANAGERS NOW')
		await this.manager.transformDir(j(this.config.entryPath, 'managers')),
		console.log('RUNNING COMMANDS NOW')
		await Promise.all([
			this.command.mergeDir(j(this.config.entryPath, 'commands')),
		]);
		await this.emitIndex(this.config.entryPath);
	}

	private async emitIndex(path: string) {
		const imports = this.graph.injections.map(i => {
			const modPath = Module.pathToRelative(i.module.buildPath, this.config.buildPath);

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
				visitor: {}
			}
		);

		const ast = result.ast ?? undefined;

		this.graph.addModule(j(path, 'index.js'), ast);
	}
}

export default Transformer;
