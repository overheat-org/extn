import traverse from "@babel/traverse";
import * as T from '@babel/types';
import client from '!!raw-loader!../helpers/client';
import ImportManager from './import-manager';
import BaseLoader from './base';
import { ReadedManager } from "./managers";

class ClientLoader extends BaseLoader {
    internalManagers = new Array<ReadedManager>
    
    async mergeWithInternalManagers() {
        const { internalManagers } = this;
        
        const importManager = new ImportManager({ 
            from: this.config.entryPath, 
            to: this.config.buildPath 
        });
        const ast = this.parseFile(client);
        
        ast.program.body.unshift(
            T.importDeclaration(
                [
                    T.importNamespaceSpecifier(T.identifier('Diseact'))
                ], 
                T.stringLiteral('diseact')
            ),
            T.expressionStatement(
                T.assignmentExpression(
                    '=',
                    T.memberExpression(
                        T.identifier('global'),
                        T.identifier('Diseact')
                    ),
                    T.identifier('Diseact')
                )
            )
        )
        importManager.parse(ast.program, { clearImportsBefore: true });

        const classes = new Array<T.ClassDeclaration>;
        
        traverse(ast!, {
            Identifier(path) {
                if(path.node.name == 'MANAGERS') {
                    const managersContent = new Array<T.BlockStatement>;

                    for(const managerContent of internalManagers.map(m => m.content)) {
                        if(managerContent) {

                        }
                        
                        importManager.parse(managerContent, { clearImportsBefore: true });
                        managersContent.push(T.blockStatement(managerContent));
                    }
                    
                    path.replaceWithMultiple(managersContent);
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

        
        return ast.program;
    }

    async load() {
        const ast = await this.mergeWithInternalManagers();
        const result = await this.transformFile(ast, { filename: 'index.tsx' });
        this.emitFile('index.js', result);
    }
}

export default ClientLoader;