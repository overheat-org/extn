import fs from 'fs';
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