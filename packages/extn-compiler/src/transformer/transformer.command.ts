import * as T from '@babel/types';
import { NodeObserver, ObserverContext } from '../parser';
import { FileTypes } from '@extn/shared';
import { ObserveNode } from '../utils/decorators';

export class CommandTransformer {
	constructor(observer: NodeObserver) {}

	@ObserveNode("ImportDeclaration")
	transformImport({ node, type }: ObserverContext<T.ImportDeclaration>) {
		if(type != FileTypes.Command) return;
		
		const source = node.node.source.value;
		const specifiers = node.node.specifiers;

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

		node.replaceWithMultiple(importExpressions as any);
	}

	@ObserveNode("ExportDefaultDeclaration")
	transformExportDefault({ node, type }: ObserverContext<T.ExportDefaultDeclaration>) {
		if(type != FileTypes.Command) return;

		node.replaceWith(T.returnStatement(node.node.declaration as T.Expression));
	}
}