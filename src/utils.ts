import fs, { readFileSync } from 'fs';
import { join as j } from 'path';
import path from 'path/posix';

export function findNodeModulesDir(startDir?: string, expectedPackage?: string, maxDepth = 10) {
    let currentDir = startDir ?? process.cwd();
    let depth = 0;

    while (currentDir !== path.parse(currentDir).root && depth < maxDepth) {
        const paths = [currentDir, 'node_modules'];
        if (expectedPackage) paths.push(expectedPackage);

        const nodeModulesPath = path.join(...paths);
        if (fs.existsSync(nodeModulesPath)) return nodeModulesPath;

        currentDir = path.dirname(currentDir);
        depth++;
    }

    throw new Error("Cannot find node_modules");
}

export function useErrors<O extends object>(
    obj: O
): { [K in keyof O]: Error } {
    const result = {} as { [K in keyof O]: Error };
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = new Error(String(obj[key]));
        }
    }
    return result;
}
