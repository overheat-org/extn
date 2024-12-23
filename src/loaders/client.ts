import { NodePath, TraverseOptions } from "@babel/traverse";
import * as T from '@babel/types';
import BaseLoader from './base';
import client from '!!raw-loader!../helpers/client';
import ImportResolver from "./import-resolver";
import { join as j } from 'path/posix';

class ClientLoader extends BaseLoader {
    injections: Record<string, string[]> = {};
    importResolver = new ImportResolver(j(this.config.entryPath), this.config);

    traverse: TraverseOptions = {
        Identifier: (path) => {
            if(path.node.name == 'MANAGERS') {
                const content = new Array<T.Node>;
                const statements = new Array<T.Statement>();

                statements.push(
                    T.importDeclaration(
                        [T.importNamespaceSpecifier(T.identifier('Diseact'))], 
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
                );

                for(const [k, v] of Object.entries(this.injections)) {
                    const identifiers = v.map(m => T.identifier(m));

                    const importDecl = T.importDeclaration(
                        identifiers.map(m => T.importNamespaceSpecifier(m)), 
                        T.stringLiteral(this.importResolver.parse(j(this.config.buildPath, 'managers', k)))
                    );

                    statements.push(importDecl);

                    const newExpressions = identifiers.map(i => T.newExpression(i, [T.identifier('client')]));

                    content.push(...newExpressions);
                }

                const programPath = path.findParent(p => p.isProgram()) as NodePath<T.Program>;
                if (programPath) {
                    programPath.unshiftContainer('body', statements);
                }

                path.replaceWithMultiple(content);
            }
        },
        ImportDeclaration: (path) => this.importResolver.resolve(path)
    }

    async load() {
        const ast = this.parseContent(client);
        const result = await this.transformFile(ast, { 
            filename: 'index.tsx',
            traverse: this.traverse
        });

        await this.emitFile('index.js', result);
    }
}

export default ClientLoader;