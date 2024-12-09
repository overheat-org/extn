import traverse from "@babel/traverse";
import * as T from '@babel/types';
import client from '!!raw-loader!../helpers/client';
import BaseLoader from './base';

class ClientLoader extends BaseLoader {
    injectedManagers: Record<string, string[]> = {}
    
    async mergeWithInternalManagers() {
        const { injectedManagers } = this;
        
        const importRegistry = this.loader.importResolver.createRegister();
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
        importRegistry.parse(ast.program, { clearImportsBefore: true });

        const classes = new Array<T.ClassDeclaration>;
        
        traverse(ast!, {
            Identifier(path) {
                if(path.node.name == 'MANAGERS') {
                    const content = new Array<T.Node>;

                    for(const [k, v] of Object.entries(injectedManagers)) {
                        const identifiers = v.map(m => T.identifier(m));

                        const importDecl = T.importDeclaration(
                            identifiers.map(m => T.importNamespaceSpecifier(m)), 
                            T.stringLiteral(k)
                        );

                        const newExpressions = identifiers.map(i => T.newExpression(i, [T.identifier('client')]));

                        importRegistry.register(importDecl);
                        content.push(...newExpressions);
                    }

                    path.replaceWithMultiple(content);
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
        
        ast.program = importRegistry.resolve(ast.program);

        
        return ast.program;
    }

    async load() {
        const ast = await this.mergeWithInternalManagers();
        const result = await this.transformFile(ast, { filename: 'index.tsx' });
        this.emitFile('index.js', result);
    }
}

export default ClientLoader;