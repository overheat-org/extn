import * as T from '@babel/types';
import { existsSync, stat, statSync } from 'fs';
import { basename, extname, isAbsolute, normalize, relative, resolve, posix } from 'path';
import { REGEX } from '../consts';
import Config from '../config';
import { readJSONFile } from './utils';
import { parse } from '@babel/parser';

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
		else if(REGEX.IS_COMMAND.test(path)) {
			return fromCommand();
		} 
		else {
			return fromEntry();
		}
	}
}


export class Module extends ModuleResolver {
	public buildPath!: string;

	constructor(
		public entryPath = "",
		public content: T.File = T.file(T.program([])),
	) {
		super();

		if(entryPath) {
			this.entryPath = Module.normalizePath(entryPath);
			this.buildPath = Module.toBuildPath(entryPath);
		}
	}

	get filename() {
		return basename(this.entryPath ?? this.buildPath);
	}
}

export class CommandModule extends Module {}