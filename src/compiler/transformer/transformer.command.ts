import * as T from '@babel/types';
import { NodePath } from "@babel/traverse";
import NodeChannels from '../node-observer';

export class CommandTransformer {
	constructor(nodes: NodeChannels) {
		// Don't forget, these functions losted yours context, 
		// use "Function.prototype.bind" if you pretend to use "this".
		nodes.commands.on("ImportDeclaration", this.transformImport);
		nodes.commands.on("ExportDefaultDeclaration", this.transformExportDefault);
	}

	transformImport(path: string, node: NodePath<T.ImportDeclaration>) {
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

	transformExportDefault(path: string, node: NodePath<T.ExportDefaultDeclaration>) {
		node.replaceWith(T.returnStatement(node.node.declaration as T.Expression));
	}
}