import fs from 'fs';
import { resolve } from 'path';
import _path from 'path/posix';
import Config from '../config';
import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';
import { SUPPORTED_EXTENSIONS_REGEX } from '../consts';

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

export type FlameErrorLocation = { path: string, line: number, column: number }

export class FlameError extends Error {
    constructor(message: string, location?: FlameErrorLocation) {
        if (location) message += `\n    at ${location.path}:${location.line}:${location.column}`;
        super(message);
        Error.captureStackTrace?.(this, FlameError);
    }
}

export function useErrors<O extends object>(
    obj: O
): { [K in keyof O]: FlameError } {
    const result = {} as any;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = new FlameError(String(obj[key]));
        }
    }
    return result;
}

export function getConstructor(path: NodePath<T.Class>) {
    return path.get('body').get('body').find(
        (method) => method.isClassMethod({ kind: 'constructor' })
    );
}

export function createConstructor(
    classPath: NodePath<T.ClassDeclaration | T.ClassExpression>,
    params: T.Identifier[] = [],
    body: T.Statement[] = []
): NodePath<T.ClassMethod> {
    const constructorMethod = T.classMethod(
        'constructor',
        T.identifier('constructor'),
        params,
        T.blockStatement(body)
    );

    classPath.get('body').pushContainer('body', constructorMethod);

    const constructorPath = classPath
        .get('body')
        .get('body')
        .find((method) => method.isClassMethod({ kind: 'constructor' })) as NodePath<T.ClassMethod>;

    return constructorPath;
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
