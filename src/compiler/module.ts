import * as T from '@babel/types';
import { existsSync, statSync } from 'fs';
import { basename, extname, isAbsolute, normalize, relative, resolve, posix } from 'path';

class ModuleResolver {
	static extensions = [".js", ".jsx", ".ts", ".tsx"]

	static normalizePath(path: string) {
		return normalize(path).split(/[/\\]/).join(posix.sep);
	}

	static resolvePath(path: string, parentPath?: string) {
		if (isAbsolute(path) && !parentPath) {
			return this.resolveFile(path, this.extensions);
		};

		if (!isAbsolute(path) && parentPath) {
			return this.resolveFile(resolve(parentPath, path), this.extensions);
		}
	}

	static resolveFile(path: string, exts: string[]) {
		path = this.normalizePath(path);

		if (existsSync(path)) {
			if (statSync(path).isFile()) return path;

			return this.resolveExt(path + posix.sep + "index", exts);
		}

		return this.resolveExt(path, exts);
	}

	static resolveExt(path: string, exts: string[]) {
		if (extname(path)) return;

		for (let ext of exts) if (existsSync(path + ext)) return path + ext;
	}

	static pathToRelative(path: string, parentPath: string) {
		let relativePath = relative(parentPath, path);
		relativePath = this.normalizePath(relativePath);

		if (!relativePath.startsWith(".")) relativePath = './' + relativePath;

		return relativePath;
	}

	static toBuildPath(path: string, parentPath: string) {
		return this
			.pathToRelative(path, parentPath)
			.replace(/\.(t|j)sx?$/, '.js');
	}
}

export class Module extends ModuleResolver {
	public filename: string;

	constructor(
		public path: string,
		public content?: T.Node,
		options?: { filename?: string }
	) {
		super();
		this.filename = options?.filename ?? basename(this.path);
	}
}
