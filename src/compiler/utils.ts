import fs from 'fs';
import { resolve } from 'path';
import _path from 'path/posix';
import Config from '../config';
import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';
import { SUPPORTED_EXTENSIONS } from '../consts/regex';
import { FlameErrorLocation } from './reporter';

export function findNodeModulesDir(startDir?: string, expectedPackage?: string, maxDepth = 10) {
    let currentDir = startDir ?? process.cwd();
    let depth = 0;

    while (currentDir !== _path.parse(currentDir).root && depth < maxDepth) {
        const paths = [currentDir, 'node_modules'];
        if (expectedPackage) paths.push(expectedPackage);

        const nodeModulesPath = _path.join(...paths);
        if (fs.existsSync(nodeModulesPath)) return nodeModulesPath;

        currentDir = _path.dirname(currentDir);
        depth++;
    }

    throw new Error("Cannot find node_modules");
}

export function getConstructor(path: NodePath<T.Class>) {
    return path.get('body').get('body').find(
        (method) => method.isClassMethod({ kind: 'constructor' })
    );
}

export function createConstructor(
    classPath: NodePath<T.ClassDeclaration | T.ClassExpression>,
    params: T.Identifier[] = [],
    body: T.Statement[] = [],
    Super = false,
): NodePath<T.ClassMethod> {
    const constructorMethod = T.classMethod(
        'constructor',
        T.identifier('constructor'),
        params,
        T.blockStatement(body)
    );

    if(Super) {
        constructorMethod.body.body.push(T.expressionStatement(T.callExpression(T.identifier('super'), [])))
    }

    classPath.get('body').pushContainer('body', constructorMethod);

    const constructorPath = classPath
        .get('body')
        .get('body')
        .find((method) => method.isClassMethod({ kind: 'constructor' })) as NodePath<T.ClassMethod>;

    return constructorPath;
}

export function getDecoratorParams(path: NodePath<T.Decorator>) {
    const expr = path.get("expression");
    if (!expr.isCallExpression()) return;

    return expr.get('arguments');
}

export function getErrorLocation(path: NodePath, filepath?: string): FlameErrorLocation {
    return { ...path.node.loc?.start! ?? {}, path: filepath };
}

export function resolveName(path: NodePath) {
    const node = path.node;

    if (T.isObjectProperty(node)) {
        if (node.computed && T.isStringLiteral(node.key)) {
            const binding = path.scope.getBinding(node.key.value);
            if (binding && T.isVariableDeclarator(binding.path.node) && T.isIdentifier(binding.path.node.id)) {
                return binding.path.node.id.name;
            }
            return node.key.value;
        } else if (!node.computed && T.isIdentifier(node.key)) {
            return node.key.name;
        }
    }

    if (T.isClassMethod(node)) {
        if (node.computed && T.isStringLiteral(node.key)) {
            const binding = path.scope.getBinding(node.key.value);
            if (binding && T.isVariableDeclarator(binding.path.node) && T.isIdentifier(binding.path.node.id)) {
                return binding.path.node.id.name;
            }
            return node.key.value;
        } else if (!node.computed && T.isIdentifier(node.key)) {
            return node.key.name;
        }
    }

    if (T.isIdentifier(node)) {
        return node.name;
    }

    throw new Error('Cannot resolve name of node');
}

// FIXME: poor solution
export function toDynamicImport(path: NodePath<T.ImportDeclaration>) {
    const source = path.node.source.value;
    const specifiers = path.node.specifiers;

    const importExpressions = specifiers.map(specifier => {
        if (T.isImportDefaultSpecifier(specifier)) {
            return T.variableDeclaration("const", [
                T.variableDeclarator(
                    specifier.local,
                    T.memberExpression(
                        T.awaitExpression(T.callExpression(T.import(), [T.stringLiteral(source)])),
                        T.identifier("default")
                    )
                )
            ]);
        }

        if (T.isImportSpecifier(specifier)) {
            return T.variableDeclaration("const", [
                T.variableDeclarator(
                    specifier.local,
                    T.memberExpression(
                        T.awaitExpression(T.callExpression(T.import(), [T.stringLiteral(source)])),
                        specifier.imported
                    )
                )
            ]);
        }
    });

    path.replaceWithMultiple(importExpressions as any);
}
