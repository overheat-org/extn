import fs from 'fs';
import _path from 'path/posix';
import * as T from '@babel/types';
import { FlameErrorLocation } from './reporter';
import _traverse, { NodePath, Visitor } from '@babel/traverse';
import { Module } from './module';
const traverse: typeof _traverse = typeof _traverse == 'object'
    ? (_traverse as any).default
    : _traverse;

export async function asyncTraverse(ast: T.Node, visitor: AsyncVisitor) {
	const promises: Promise<any>[] = [];

	const wrappedVisitor: any = {};

	for (const key of Object.keys(visitor)) {
		const originalMethod = visitor[key as keyof AsyncVisitor];

		if (originalMethod && typeof originalMethod === 'function') {
			wrappedVisitor[key] = function (path: NodePath<any>) {
				const result = originalMethod(path as any);
				if (result && typeof result.then === 'function') {
					promises.push(result);
				}
			};
		}
	}

	traverse(ast, wrappedVisitor as Visitor);

	await Promise.all(promises);
}

export type AsyncVisitor = {
    [K in keyof Visitor]?: (path: NodePath<Extract<T.Node, { type: K }>>) => Promise<void> | void;
};


export function readJSONFile<T = any>(path: string) {
    const file = fs.readFileSync(path, 'utf-8');
    return JSON.parse(file) as T;
}

export function findNodeModulesDir(startDir?: string, expectedPackage?: string, maxDepth = 10) {
    let currentDir = startDir ?? process.cwd();
    let depth = 0;

    while (currentDir !== _path.parse(currentDir).root && depth < maxDepth) {
        const paths = [currentDir, 'node_modules'];
        if (expectedPackage) paths.push(expectedPackage);

        const nodeModulesPath = _path.join(...paths, '/');
        if (fs.existsSync(nodeModulesPath)) return nodeModulesPath;

        currentDir = _path.dirname(_path.resolve(currentDir));
        depth++;
    }

    throw new Error("Cannot find node_modules");
}

export function getErrorLocation(path: NodePath, module?: Module): FlameErrorLocation {
    const loc = path?.node?.loc?.start;
    return { ...(loc ?? {}), path: module?.entryPath };
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
