import { describe, expect, test } from "bun:test";
import ImportManager, { DynamicImport, TopLevelImport } from './import-manager';
import * as T from '@babel/types';

describe('ImportManager', () => {
    describe('TopLevelImport', () => {
        test('should handle default import', () => {
            const importDecl = T.importDeclaration(
                [T.importDefaultSpecifier(T.identifier('myDefault'))],
                T.stringLiteral('./module')
            );

            const manager = ImportManager.fromTopLevel(importDecl);
            const dynamic = manager.toDynamic();

            expect(T.isVariableDeclaration(dynamic.specifiers)).toBe(true);
            const declaration = dynamic.specifiers as T.VariableDeclaration;
            expect(declaration.declarations[0].id.name).toBe('myDefault');
        });

        test('should handle named imports', () => {
            const importDecl = T.importDeclaration(
                [
                    T.importSpecifier(
                        T.identifier('localName'),
                        T.identifier('exportName')
                    )
                ],
                T.stringLiteral('./module')
            );

            const manager = ImportManager.fromTopLevel(importDecl);
            const dynamic = manager.toDynamic();

            expect(T.isVariableDeclaration(dynamic.specifiers)).toBe(true);
            const declaration = dynamic.specifiers as T.VariableDeclaration;
            expect(T.isObjectPattern(declaration.declarations[0].id)).toBe(true);
        });

        test('should handle namespace import', () => {
            const importDecl = T.importDeclaration(
                [T.importNamespaceSpecifier(T.identifier('myNamespace'))],
                T.stringLiteral('./module')
            );

            const manager = ImportManager.fromTopLevel(importDecl);
            const dynamic = manager.toDynamic();

            expect(T.isVariableDeclaration(dynamic.specifiers)).toBe(true);
            const declaration = dynamic.specifiers as T.VariableDeclaration;
            expect(declaration.declarations[0].id.name).toBe('myNamespace');
        });

        test('should handle mixed default and named imports', () => {
            const importDecl = T.importDeclaration(
                [
                    T.importDefaultSpecifier(T.identifier('myDefault')),
                    T.importSpecifier(
                        T.identifier('localName'),
                        T.identifier('exportName')
                    )
                ],
                T.stringLiteral('./module')
            );

            const manager = ImportManager.fromTopLevel(importDecl);
            const dynamic = manager.toDynamic();

            expect(T.isVariableDeclaration(dynamic.specifiers)).toBe(true);
            const declaration = dynamic.specifiers as T.VariableDeclaration;
            expect(T.isObjectPattern(declaration.declarations[0].id)).toBe(true);
        });

        test('should handle side-effect imports', () => {
            const importDecl = T.importDeclaration(
                [],
                T.stringLiteral('./module')
            );

            const manager = ImportManager.fromTopLevel(importDecl);
            const dynamic = manager.toDynamic();

            expect(T.isExpressionStatement(dynamic.specifiers)).toBe(true);
            const stmt = dynamic.specifiers as T.ExpressionStatement;
            expect(T.isAwaitExpression(stmt.expression)).toBe(true);
        });

        test('should handle import assertions', () => {
            const importDecl = T.importDeclaration(
                [T.importDefaultSpecifier(T.identifier('myJson'))],
                T.stringLiteral('./data.json'),
                [T.importAttribute(
                    T.identifier('type'),
                    T.stringLiteral('json')
                )]
            );

            const manager = ImportManager.fromTopLevel(importDecl);
            const dynamic = manager.toDynamic();

            // Bun fornece uma maneira mais direta de fazer assertions
            expect(
                T.isImportExpression(
                    (dynamic.specifiers as T.VariableDeclaration)
                        .declarations[0].init.argument
                )
            ).toBe(true);
            expect(dynamic.options).toBeTruthy();
        });
    });

    describe('DynamicImport', () => {
        test('should handle basic dynamic import', () => {
            const importExpr = T.importExpression(
                T.stringLiteral('./module')
            );

            const manager = ImportManager.fromDynamic(importExpr);
            expect(manager.source.value).toBe('./module');
        });

        test('should handle dynamic import with assertions', () => {
            const importExpr = T.importExpression(
                T.stringLiteral('./data.json'),
                T.objectExpression([
                    T.objectProperty(
                        T.identifier('assert'),
                        T.objectExpression([
                            T.objectProperty(
                                T.identifier('type'),
                                T.stringLiteral('json')
                            )
                        ])
                    )
                ])
            );

            const manager = ImportManager.fromDynamic(importExpr);
            expect(manager.options).toBeTruthy();
            expect(T.isObjectExpression(manager.options)).toBe(true);
        });

        test('should convert dynamic to top-level while preserving assertions', () => {
            const importExpr = T.importExpression(
                T.stringLiteral('./data.json'),
                T.objectExpression([
                    T.objectProperty(
                        T.identifier('assert'),
                        T.objectExpression([
                            T.objectProperty(
                                T.identifier('type'),
                                T.stringLiteral('json')
                            )
                        ])
                    )
                ])
            );

            const manager = ImportManager.fromDynamic(importExpr);
            const topLevel = manager.toTopLevel(
                T.importDeclaration(
                    [T.importDefaultSpecifier(T.identifier('myJson'))],
                    T.stringLiteral('./data.json')
                )
            );

            expect(topLevel.attributes).toBeTruthy();
            expect(topLevel.attributes![0].key.name).toBe('type');
            expect(topLevel.attributes![0].value.value).toBe('json');
        });
    });

    describe('ImportManager.from', () => {
        test('should detect top-level import', () => {
            const importDecl = T.importDeclaration(
                [T.importDefaultSpecifier(T.identifier('myDefault'))],
                T.stringLiteral('./module')
            );

            const manager = ImportManager.from(importDecl);
            expect(manager).toBeInstanceOf(TopLevelImport);
        });

        test('should detect dynamic import', () => {
            const importExpr = T.importExpression(
                T.stringLiteral('./module')
            );

            const manager = ImportManager.from(importExpr);
            expect(manager).toBeInstanceOf(DynamicImport);
        });
    });
});
