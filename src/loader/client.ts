import fs from 'fs/promises';
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from '@babel/generator';
import * as T from '@babel/types';
import { join as j } from 'path';
import Config from "../config";
import client from '!!raw-loader!../helpers/client';
import ImportManager from '../import-manager';

class ClientLoader {
    parseFile() {
        return parse(client, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators']
        });
    }

    async mergeInternalManagers(internalManagers: T.Statement[]) {
        const importManager = new ImportManager;
        const ast = this.parseFile();

        const classes = new Array<T.ClassDeclaration>;
        const exportedClasses = new Array<T.Identifier>;
        
        traverse(ast!, {
            Identifier(path) {
                // TODO: Don't emit when manager aren't exported by default
                if(path.node.name == 'MANAGERS') {
                    path.replaceWithMultiple(internalManagers);
                }
            },
            ExportDefaultDeclaration(path) {
                const { declaration } = path.node;

                switch(true) {
                    case T.isClassDeclaration(declaration): {
                        const instantiate = T.newExpression(
                            T.identifier(declaration.id!.name),
                            [T.identifier('client')]
                        );
        
                        path.insertAfter(T.expressionStatement(instantiate));
                        path.replaceWith(declaration);
                        break;
                    }
                        
                    case T.isIdentifier(declaration): {
                        const selectedClass = classes.find(c => c.id?.name == declaration.name);
                        if(!selectedClass) break;

                        const instantiate = T.newExpression(
                            T.identifier(selectedClass.id!.name),
                            [T.identifier('client')]
                        );

                        path.insertBefore(T.expressionStatement(instantiate))
                        path.remove();
                        break;
                    }
                }
            },
            ClassDeclaration(path) {
                classes.push(path.node);
            }
        });
        
        ast.program = importManager.resolve(ast.program);
        
        return ast;
    }

    async writeFile(ast) {
        const out = generate(ast, {
            comments: false,
            
        });

        await fs.mkdir(j(this.config.buildPath, 'tmp'), { recursive: true });
        await fs.writeFile(j(this.config.buildPath, 'tmp', 'index.tsx'), out.code);
    }
    
    async load(internalManagers: T.Statement[]) {
        const ast = await this.mergeInternalManagers(internalManagers);
        this.writeFile(ast);
    }
    
    constructor(private config: Config) {}
}

export default ClientLoader;