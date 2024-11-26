import traverse from "@babel/traverse";
import { parse } from "@babel/parser";
import * as T from '@babel/types';
import fs from 'fs/promises';
import Config from "../config";
import { join as j } from 'path/posix';
import { findNodeModulesDir } from "../utils";

interface ParsedManager {
    path: string;
    isInternal: boolean;
    content: T.Statement[];
}

class ManagersLoader {
    async parseFile(filePath: string) { 
        const buf = await fs.readFile(filePath);
        const ast = parse(buf.toString('utf-8'), {
            sourceType: 'module',
            plugins: ['typescript', 'decorators', 'jsx'],
        });
        
        let isInternal = false;
        const classes = new Array<T.ClassDeclaration>();
        
        traverse(ast!, {
            ExportDefaultDeclaration(path) {
                const declaration = path.node.declaration;
                
                if (declaration.type !== 'Identifier') {
                    throw new Error(`Expected class declaration, found "${declaration.type}"`);
                }
                
                const selectedClass = classes.find(c => declaration.name === c.id?.name);
                
                isInternal = !!selectedClass?.decorators?.find(
                    (d: T.Decorator) => d.expression.type === 'Identifier' && d.expression.name === 'inject'
                );

                // Remove decorator from ast
                if (selectedClass && selectedClass.decorators) {
                    selectedClass.decorators = selectedClass.decorators.filter(
                        (d: any) => !(d.expression.type === 'Identifier' && d.expression.name === 'inject')
                    );
                }
            },
            ClassDeclaration(path) {
                classes.push(path.node);
            }
        });

        return {
            path: filePath,
            isInternal,
            content: ast?.program.body
        } as ParsedManager;
    }

    async readDir(dir: string) {
        const content = await fs.readdir(dir, { withFileTypes: true });
        const internalManagers = new Array<T.Statement>;

        for(const dirent of content) {
            if(!/\.(j|t)sx?$/.test(dirent.name)) continue;

            let parsed: ParsedManager;
            
            if(dirent.isDirectory()) {
                const files = await fs.readdir(j(dir, dirent.name));
                if(!files.includes('index')) continue;

                parsed = await this.parseFile(j(dir, dirent.name, 'index'));
            }
            else parsed = await this.parseFile(j(dir, dirent.name));

            if(parsed.isInternal) {
                internalManagers.push(...parsed.content);
            }
        }

        return internalManagers;
    }

    async load() {
        const managersDir = j(this.config.entryPath, 'managers');
        const localInternal = await this.readDir(managersDir);

        const flameDir = findNodeModulesDir(this.config.cwd, '@flame-oh')!;
        if(!flameDir) return localInternal;
        const flameInternal = await this.readDir(flameDir);

        return [...localInternal, ...flameInternal];
    }

    constructor(private config: Config) {}
}

export default ManagersLoader;