import * as T from '@babel/types';
import { existsSync, statSync } from 'fs';
import { basename, extname, isAbsolute, normalize, relative, resolve, posix, dirname } from 'path';
import { REGEX } from '../consts';
import Config from '../config';
import { asyncTraverse, AsyncVisitor, getErrorLocation, readJSONFile, toDynamicImport } from './utils';
import Transformer, { TransformStrategy } from './transformer';
import { NodePath } from '@babel/traverse';
import { PluginItem } from '@babel/core';
import { FlameError } from './reporter';
import { DecoratorAnalyzer } from './analyzer';

/**
 * ModuleResolver class provides utility methods to resolve and manipulate file paths.
 */
class ModuleResolver {
	static config: Config;

	/**
	 * Normalizes a given path by converting all path separators to POSIX style (`/`).
	 */
	static normalizePath(path: string) {
		return normalize(path).split(/[/\\]/).join(posix.sep);
	}

	/**
	 * Resolves a given file path, considering if it's an absolute path or relative to a parent path.
	 * If the path is relative, it will be resolved against the parent path.
	 */
	static resolvePath(path: string, parentPath?: string) {
		if (isAbsolute(path) && !parentPath) {
			return this.resolveFile(path, this.config.extensions);
		};

		if (!isAbsolute(path) && parentPath) {
			return this.resolveFile(resolve(parentPath, path), this.config.extensions);
		}

		return path;
	}

	/**
	 * Resolves a file path by checking if it exists.
	 * If it's a directory, it attempts to resolve using "package.json" (exports, main),
	 * and falls back to "index" if needed.
	 *
	 * Resolution order for folders:
	 *   1. package.json "exports"
	 *   2. package.json "main"
	 *   3. index file
	 */
	static resolveFile(path: string, exts: string[]): string | undefined {
		path = this.normalizePath(path);

		const resolveFolder = (): string | undefined => {
			const pkgPath = path + "/package.json";

			if (existsSync(pkgPath)) {
				const pkg = readJSONFile(pkgPath);

				if (pkg.exports) {
					const target = typeof pkg.exports === "string" ? pkg.exports : pkg.exports["."] || pkg.exports["default"];
					if (target) {
						const resolved = this.resolveFile(path + "/" + target, exts);
						if (resolved) return resolved;
					}
				}

				if (pkg.main) {
					const resolved = this.resolveFile(path + "/" + pkg.main, exts);
					if (resolved) return resolved;
				}
			}

			return this.resolveFile(path + "/index", exts);
		};

		if (existsSync(path)) {
			return statSync(path).isFile() ? path : resolveFolder();
		}

		// Try with extensions
		return this.resolveExt(path, exts);
	}

	/**
	 * Resolves a file path by appending possible extensions if none is present.
	 */
	static resolveExt(path: string, exts: string[]) {
		// If the path already has an extension, do nothing
		if (extname(path)) return;

		// Try each extension and return the first path that exists
		for (let ext of exts) if (existsSync(path + ext)) return path + ext;
	}

	/**
	 * Converts an absolute path to a relative path based on a parent path.
	 */
	static pathToRelative(path: string, parentPath: string) {
		let relativePath = relative(parentPath, path);
		relativePath = this.normalizePath(relativePath);

		// Ensure the relative path starts with './' if not already
		if (!relativePath.startsWith(".")) relativePath = './' + relativePath;

		return relativePath;
	}

	/**
	 * Converts a module path to its build path by replacing specific parts of the path.
	 * If the path corresponds to a "flame" module, it replaces it with the build path.
	 * Otherwise, it replaces the entry path with the build path.
	 */
	static toBuildPath(path: string) {
		const fromFlame = () => {
			const ALL_BEFORE_FLAME_MODULE = RegExp.merge(/^.*node_modules\//, REGEX.FLAME_MODULE);
			const name = path.match(REGEX.FLAME_MODULE)![1];

			return path
				.replace(ALL_BEFORE_FLAME_MODULE, `${this.config.buildPath}/managers/${name}`)
				.replace(/^.*?(manager\/[^/]+)\/(?:[^/]+\/)+([^/]+)$/, '$1/$2')
				.replace(REGEX.SUPPORTED_EXTENSIONS, ".js");
		}

		const fromEntry = () => {
			return path
				.replace(this.config.entryPath, this.config.buildPath)
				.replace(REGEX.SUPPORTED_EXTENSIONS, ".js");
		}

		const fromCommand = () => {
			return `${this.config.buildPath}/commands.js`;
		}

		if (REGEX.FLAME_MODULE.test(path)) {
			return fromFlame();
		}
		else if (REGEX.IS_COMMAND.test(path)) {
			return fromCommand();
		}
		else {
			return fromEntry();
		}
	}
}

class TransformModuleStrategy extends TransformStrategy {
	presets: PluginItem[] = [
		"@babel/preset-typescript",
		["@babel/preset-react", { runtime: "automatic", importSource: "diseact" }],
	]

	async ImportDeclaration(path: NodePath<T.ImportDeclaration>) {
		if (path.removed) return;

		const absolutePath = await this.importResolver.resolve(path.node.source.value, this.module.entryPath);
		if (!absolutePath) return;

		const module = this.graph.getModule(absolutePath);
		if (!module) return;

		if (
			path.node.specifiers.length == 0 &&
			(
				REGEX.IS_COMMAND_FILE.test(path.node.source.value) || 
				REGEX.FLAME_MODULE.test(path.node.source.value)
			)
		) {
			path.remove();
		}
		else {
			if(!(Module instanceof NodeModule)) return;
			
			const relativePath = Module.pathToRelative(module.buildPath, dirname(module.buildPath));
			path.get('source').set('value', relativePath);
		}
	}

	Decorator(path: NodePath<T.Decorator>) {
		const expr = path.get('expression');

		let name: string | undefined;

		if (expr.isIdentifier()) {
			name = expr.node.name;
		} else if (expr.isCallExpression()) {
			const callee = expr.get('callee');
			if (callee.isIdentifier()) {
				name = callee.node.name;
			} else if (callee.isMemberExpression()) {
				const object = callee.get('object');
				if (object.isIdentifier()) {
					name = object.node.name;
				}
			}
		} else if (expr.isMemberExpression()) {
			const object = expr.get('object');
			if (object.isIdentifier()) {
				name = object.node.name;
			}
		}

		if (name && /^[a-z]/.test(name)) {
			path.remove();
		}
	}
}

interface BaseModule {
	readonly transformStrategy?: TransformStrategy;
	readonly entryPath: string;
	readonly content?: T.File;
	transform?: (transformer: Transformer) => Promise<void>;
}

export class Module extends ModuleResolver implements BaseModule {
	readonly transformStrategy = new TransformModuleStrategy(this);
	readonly analyzers = [
		new DecoratorAnalyzer(this),
	]

	private static instances = new Map<string, Module>();

	public buildPath!: string;

	protected constructor(
		public entryPath = "",
		public content: T.File = T.file(T.program([])),
	) {
		super();

		if (entryPath) {
			this.buildPath = Module.toBuildPath(entryPath);
		}
	}

	static from(entryPath: string, content?: T.File) {
		const normalized = Module.normalizePath(entryPath);
		if (entryPath && this.instances.has(normalized)) {
			return this.instances.get(normalized)!;
		}
		const instance = new this(normalized, content);
		this.instances.set(normalized, instance);
		return instance;
	}

	get basename() {
		return basename(this.entryPath ?? this.buildPath);
	}

	traverse(visitors: AsyncVisitor) {
		return asyncTraverse(this.content, visitors);
	}

	transform(transformer: Transformer) {
		return transformer.transformModule(this);
	}
}

export class NodeModule implements BaseModule {
	private static instances = new Map<string, NodeModule>();

	private constructor(
		public entryPath: string,
	) { }

	static from(entryPath: string) {
		const normalized = Module.normalizePath(entryPath);
		if (entryPath && this.instances.has(normalized)) {
			return this.instances.get(normalized)!;
		}
		const instance = new this(normalized);
		this.instances.set(normalized, instance);
		return instance;
	}

	get basename() {
		return basename(this.entryPath);
	}
}

class TransformCommandModuleStrategy extends TransformStrategy {
	presets: PluginItem[] = [
		"@babel/preset-typescript",
		["@babel/preset-react", { pragma: "_jsx", pragmaFrag: "_Frag" }]
	]

	async _importSource(path: NodePath<T.ImportDeclaration>) {
		if (path.removed) return;

		if (module) {
			const relativePath = Module.pathToRelative(this.module.buildPath, this.config.buildPath);
			path.get('source').set('value', relativePath);
		}

		toDynamicImport(path);
	}

	async ImportDeclaration(path: NodePath<T.ImportDeclaration>) {
		if (path.removed) return;

		const absolutePath = await this.importResolver.resolve(path.node.source.value, this.module.entryPath)
		if (!absolutePath) return;

		const module = this.graph.getModule(absolutePath);
		if (!module) return;

		if(!(module instanceof NodeModule)) {
			const relativePath = Module.pathToRelative(module.buildPath, this.config.buildPath);
			path.get('source').set('value', relativePath);
		}

		toDynamicImport(path);
	}

	EnumDeclaration(path: NodePath<T.EnumDeclaration>) {
		throw new FlameError('Cannot use enum in command', getErrorLocation(path, this.module));
	}

	ClassDeclaration(path: NodePath<T.ClassDeclaration>) {
		throw new FlameError('Cannot use class in command', getErrorLocation(path, this.module));
	}

	ExportNamedDeclaration(path: NodePath<T.ExportNamedDeclaration>) {
		const node = path.node;

		if (node.specifiers.length == 0) return;

		throw new FlameError('Cannot export in command', getErrorLocation(path, this.module));
	}

	ExportDefaultDeclaration(path: NodePath<T.ExportDefaultDeclaration>) {
		path.replaceWith(T.returnStatement(path.node.declaration as T.Expression));
	}
}

export class CommandModule extends Module {
	readonly transformStrategy = new TransformCommandModuleStrategy(this);

	private static instances = new Map<string, Module>();

	static from(entryPath: string, content?: T.File) {
		const normalized = Module.normalizePath(entryPath);
		if (entryPath && this.instances.has(normalized)) {
			return this.instances.get(normalized)!;
		}
		const instance = new this(normalized, content);
		this.instances.set(normalized, instance);
		return instance;
	}
}