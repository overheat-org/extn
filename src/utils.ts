import fs, { readFileSync } from 'fs';
import { join as j } from 'path';
import path from 'path/posix';

export function findNodeModulesDir(startDir = process.cwd(), expectedPackage?: string) {
    let currentDir = startDir;
  
    while (currentDir !== path.parse(currentDir).root) {
        const paths = [currentDir, 'node_modules'];
        if(expectedPackage) paths.push(expectedPackage);

        const nodeModulesPath = path.join(...paths);
        if (fs.existsSync(nodeModulesPath)) return nodeModulesPath;
        currentDir = path.dirname(currentDir);
    }
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
