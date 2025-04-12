import * as T from '@babel/types';
import { existsSync, stat, statSync } from 'fs';
import { basename, extname, isAbsolute, normalize, relative, resolve, posix } from 'path';
import { REGEX } from '../consts';
import Config from '../config';
import { readJSONFile } from './utils';

/**
 * ModuleResolver class provides utility methods to resolve and manipulate file paths.
 */
class ModuleResolver {
	static config: Config;

	/**
	 * Normalizes a given path by converting all path separators to POSIX style (`/`).
	 * @param {string} path - The path to be normalized.
	 * @returns {string} The normalized path with POSIX separators.
	 */
	static normalizePath(path: string) {
		return normalize(path).split(/[/\\]/).join(posix.sep);
	}

	/**
	 * Resolves a given file path, considering if it's an absolute path or relative to a parent path.
	 * If the path is relative, it will be resolved against the parent path.
	 * @param {string} path - The path to resolve.
	 * @param {string} [parentPath] - The parent path to resolve against (if the path is relative).
	 * @returns {string} The resolved file path.
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
	 *
	 * @param {string} path - The path to resolve.
	 * @param {string[]} exts - List of extensions to try when resolving files.
	 * @returns {string | undefined} - The resolved file path or undefined if not found.
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
	 * @param {string} path - The path to resolve.
	 * @param {string[]} exts - List of extensions to try.
	 * @returns {string | undefined} The path with the resolved extension or undefined if not found.
	 */
	static resolveExt(path: string, exts: string[]) {
		// If the path already has an extension, do nothing
		if (extname(path)) return;

		// Try each extension and return the first path that exists
		for (let ext of exts) if (existsSync(path + ext)) return path + ext;
	}

	/**
	 * Converts an absolute path to a relative path based on a parent path.
	 * @param {string} path - The target path to convert to relative.
	 * @param {string} parentPath - The parent path to calculate the relative path from.
	 * @returns {string} The relative path.
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
	 * @param {string} path - The module path to convert to the build path.
	 * @returns {string} The resolved build path.
	 */
	static toBuildPath(path: string) {
		const fromFlame = () => {
			const ALL_BEFORE_FLAME_MODULE = new RegExp(`^.*node_modules/${REGEX.FLAME_MODULE.source}\/`);

			path = path.replace(ALL_BEFORE_FLAME_MODULE, this.config.buildPath);

			return path;
		}

		const fromEntry = () => {
			path = path.replace(this.config.entryPath, this.config.buildPath);

			return path;
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
	public filename: string;
	public content?: T.File;
	public buildPath: string;

	constructor(
		public entryPath: string,
		content?: T.File | string,
		options?: { filename?: string }
	) {
		super();

		this.entryPath = Module.normalizePath(entryPath);
		this.filename = options?.filename ?? basename(this.entryPath);
		this.buildPath = Module.toBuildPath(entryPath);
	}
}
