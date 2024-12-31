import fs from 'fs/promises';
import BaseLoader from "./base";
import { join as j } from 'path/posix';
import ImportResolver from './import-resolver';

const IGNORE_DIRS = [
    '.git',
    '.vscode',
    'node_modules',
    'commands', 
    'managers'
];

class CommonLoader extends BaseLoader {
    importResolver = new ImportResolver(this.config.entryPath, this.config);
    
    async loadDir(dirPath: string = this.config.entryPath) {
        const dirent = await fs.readdir(dirPath, { withFileTypes: true });

        dirent.forEach(async dir => {
            if(IGNORE_DIRS.includes(dir.name)) return;
            
            const filePath = j(dirPath, dir.name);

            if(dir.isFile()) {
                if(!this.loader.extensions.some(e => this.toExtension(filePath) == e)) return; 

                const content = await fs.readFile(filePath, 'utf-8');
                const parsed = this.parseContent(content);
                const newFilePath = filePath.replace(this.config.entryPath, this.config.buildPath).replace(/.(j|t)sx?$/, '.js');
                const transformated = await this.transformContent(parsed, { 
                    filename: dir.name,
                    traverse: {
                        ImportDeclaration: (path) => this.importResolver.resolve(path)
                    }
                });
                await this.emitAbsoluteFile(newFilePath, transformated);
            }
            else await this.loadDir(filePath);
        });
    }
    
    load() {
        return this.loadDir();
    }
}

export default CommonLoader;