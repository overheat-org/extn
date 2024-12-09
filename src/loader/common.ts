import fs from 'fs/promises';
import BaseLoader from "./base";
import { join as j } from 'path/posix';
import { ParseTree } from './scanner';

const IGNORE_DIRS = ['commands', 'managers'];

class CommonLoader extends BaseLoader {
    async loadDir(dirPath: string) {
        const dirent = await fs.readdir(dirPath, { withFileTypes: true });

        dirent.forEach(async dir => {
            if(IGNORE_DIRS.includes(dir.name)) return;
            
            const filePath = j(dirPath, dir.name);

            if(dir.isFile()) {
                if(!this.loader.extensions.some(e => this.toExtension(filePath) == e)) return; 

                const content = await fs.readFile(filePath, 'utf-8');
                const parsed = this.parseFile(content);
                const newFilePath = filePath.replace(this.config.entryPath, this.config.buildPath).replace(/.(j|t)sx?$/, '.js');
                const transformated = await this.transformFile(parsed, { filename: dir.name });
                await this.emitAbsoluteFile(newFilePath, transformated);
            }
            else await this.loadDir(filePath);
        });
    }

    async load(tree: ParseTree) {
        const dirent = await fs.readdir(this.config.entryPath, { withFileTypes: true });

        for(const dir of dirent) {
            if(IGNORE_DIRS.includes(dir.name)) continue;

            await this.loadDir(j(this.config.entryPath, dir.name));
        }
    }
}

export default CommonLoader;