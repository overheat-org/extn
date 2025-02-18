import fs from 'fs';
import { join as j, normalize, posix, sep } from 'path';
import _path from 'path/posix';
import Config from '../config';

export function findNodeModulesDir(startDir?: string, expectedPackage?: string, maxDepth = 10) {
    let currentDir = startDir ?? process.cwd();
    let depth = 0;

    while (currentDir !== _path.parse(currentDir).root && depth < maxDepth) {
        const paths = [currentDir, 'node_modules'];
        if (expectedPackage) paths.push(expectedPackage);

        const nodeModulesPath = _path.join(...paths);
        if (fs.existsSync(nodeModulesPath)) return nodeModulesPath;

        currentDir = _path.dirname(currentDir);
        depth++;
    }

    throw new Error("Cannot find node_modules");
}

export type FlameErrorLocation = { path: string, line: number, column: number }

export class FlameError extends Error {
    constructor(message: string, location?: FlameErrorLocation) {
        if(location) message += `\n    at ${location.path}:${location.line}:${location.column}`;
        super(message);
        Error.captureStackTrace?.(this, FlameError);
    }
}

export function useErrors<O extends object>(
    obj: O
): { [K in keyof O]: FlameError } {
    const result = {} as any;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = new FlameError(String(obj[key]));
        }
    }
    return result;
}

export function transformImportPath(
    selfPath: string,
    newSelfPath: string,
    importPath: string,
    config: Config
): string {
    const absImport = _path.resolve(_path.dirname(selfPath), importPath);
    const relToEntry = _path.relative(config.entryPath, absImport);
    const builtImport = _path.join(config.buildPath, relToEntry);
    let relFromNewSelf = _path.relative(_path.dirname(j(config.buildPath, newSelfPath)), builtImport);
    if (!relFromNewSelf.startsWith('.')) {
        relFromNewSelf = '.' + _path.sep + relFromNewSelf;
    }
    return relFromNewSelf;
}

export function resolvePath(path: string, exts = ['.ts', '.tsx', '.js', '.jsx']) {
    if (fs.existsSync(path) && fs.statSync(path).isDirectory()) path = _path.join(path, 'index');
    if (!_path.extname(path))
      for (let ext of exts) if (fs.existsSync(path + ext)) return path + ext;
    return path;
}

export function toPosix(path: string) {
    return normalize(path).split(sep).join(posix.sep);
}