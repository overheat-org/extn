import fs from 'fs/promises';
import * as T from '@babel/types';
import { basename, join as j } from 'path/posix';
import { Dirent } from 'fs';
import { parse } from '@babel/parser';
import ImportRegistry, { ImportResolver } from './import-registry';
import Config from '../config';

const EXCLUDE_DIRECTORIES = [
    "node_modules",
    ".git",
    "core"
]

export class Tree extends Map<FileSymbol, Content> {
    constructor(public name: string) {
        super();
    }
}

/**
 * Parse all files before build
 */
class Scanner {
    private tree: Tree;
    
    imports: ImportRegistry;

    private parseFile(content: string) {
        return parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators']
        })
    }

    private async parseDir(path: string | Dirent, tree: Tree = this.tree) {
        if(typeof path != 'string') path = j(path.parentPath, path.name);
        
        const dirents = await fs.readdir(path, { withFileTypes: true });

        for(const dirent of dirents) {
            const filePath = j(dirent.parentPath, dirent.name);

            if(dirent.isFile()) {
                const content = await fs.readFile(filePath, 'utf-8');
                
                if(dirent.name == 'package.json') {
                    const { main } = JSON.parse(content);
                    
                    tree.set(
                        dirent.name,
                        await this.parseDir(
                            basename(j(filePath, main)), 
                            new Tree(dirent.name)
                        )
                    );
                } 
                else {
                    if(!/\.(j|t)sx?$/.test(dirent.name)) continue;

                    tree.set(
                        dirent.name,
                        this.parseFile(content)
                    );
                }
                
            }
            else {
                if(EXCLUDE_DIRECTORIES.includes(dirent.name)) continue;

                tree.set(
                    dirent.name, 
                    await this.parseDir(
                        j(path, dirent.name),
                        new Tree(dirent.name)
                    )
                );
            }
        }

        return tree;
    }

    static isFile(content: Content): content is T.File {
        return T.isNode(content) && T.isFile(content);
    }

    async run() {
        await this.parseDir(this.config.entryPath);

        return this.tree;
    }
    
    constructor(private config: Config, importResolver: ImportResolver) {
        this.imports = importResolver.createRegister("");
        this.tree = new Tree(basename(config.entryPath));
    }
}

export default Scanner;

/**
 * The path without entry path part
 */
type FileSymbol = string;

/**
 * The AST of file parsed
 */
export type Content = T.File | Tree;