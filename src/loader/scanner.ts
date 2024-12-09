import fs from 'fs/promises';
import * as T from '@babel/types';
import { basename, join } from 'path/posix';
import { Dirent } from 'fs';
import { parse } from '@babel/parser';

export class Tree extends Map<FileSymbol, Content> {
    constructor(public name: string) {
        super();
    }
}

/**
 * The path without entry path part
 */
type FileSymbol = string;

/**
 * The AST of file parsed
 */
type Content = T.File | Tree;

/**
 * Parse all files before build
 */
class Scanner {
    static isFile(content: Content): content is T.File {
        return T.isNode(content) && T.isFile(content);
    }

    private tree: Tree;

    private async parseDir(path: string | Dirent, tree: Tree = this.tree) {
        if(typeof path != 'string') path = join(path.parentPath, path.name);
        
        const dirents = await fs.readdir(path, { withFileTypes: true });

        for(const dirent of dirents) {
            const filePath = join(dirent.parentPath, dirent.name);

            if(dirent.isFile()) {
                const content = await fs.readFile(filePath, 'utf-8');
                
                tree.set(
                    dirent.name,
                    parse(content, {
                        sourceType: 'module',
                        plugins: ['typescript', 'jsx', 'decorators']
                    })
                )
            }
            else {
                tree.set(
                    dirent.name, 
                    await this.parseDir(path)
                );
            }
        }

        return tree;
    }

    async run() {
        await this.parseDir(this.entryPath);

        return this.tree;
    }
    
    constructor(private entryPath: string) {
        this.tree = new Tree(basename(entryPath));
    }
}

export default Scanner;