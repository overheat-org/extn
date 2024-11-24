import traverse from "@babel/traverse";
import { parse } from "@babel/parser";
import * as T from '@babel/types';
import generate from '@babel/generator';
import fs from 'fs/promises';
import Config from "../config";
import { join as j } from 'path/posix';

interface ParsedManager {
    path: string;
    hasInjected: boolean;
    content: T.Statement[];
}

class ManagersLoader {
    async parseFile(filePath: string) { 
        const buf = await fs.readFile(filePath);
        const ast = parse(buf.toString('utf-8'), {
            sourceType: 'module',
            plugins: ['typescript', 'decorators', 'jsx'],
        });
        
        let hasInjected = false;
        const classes = new Array<T.ClassDeclaration>();
        
        traverse(ast!, {
            ExportDefaultDeclaration(path) {
                const declaration = path.node.declaration;
                
                if (declaration.type !== 'Identifier') {
                    throw new Error(`Expected class declaration, found "${declaration.type}"`);
                }
                
                const selectedClass = classes.find(c => declaration.name === c.id?.name);
                
                hasInjected = !!selectedClass?.decorators?.find(
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
            hasInjected,
            content: ast?.program.body
        } as ParsedManager;
    }

    async loadManagersDir() {
        const commandsDir = j(this.config.entryPath, 'managers');
        const files = await fs.readdir(commandsDir, { withFileTypes: true });
        const internalManagers = new Array<T.Statement>;
        const managersPath = new Array<string>;
        
        for (const file of files) {
            if(!/\.(j|t)sx?$/.test(file.name)) continue;
            
            let parsed: ParsedManager;
            
            if(file.isDirectory()) {
                const files = await fs.readdir(j(commandsDir, file.name));
                if(!files.includes('index')) continue;
                
                parsed = await this.parseFile(j(commandsDir, file.name, 'index'));
            }
            else parsed = await this.parseFile(j(commandsDir, file.name));
            
            if(parsed.hasInjected) {
                internalManagers.push(...parsed.content);
            }
            else managersPath.push(parsed.path);
        }

        return { internalManagers, managersPath }
    }

    constructor(private config: Config) {}
}

export default ManagersLoader;