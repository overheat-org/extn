import * as T from "@babel/types";
import { NodePath } from "@babel/traverse";
import decorators from "../def/decorators";
import { DecoratorDefinition, DecoratorTransformContext, TransformType } from "../def/base";
import { FlameError, getErrorLocation } from "../reporter";
import Compiler from ".";

type BaseDecoratorNodeWrapper = {
	id: string
	name: string | string[]
	params: NodePath<T.CallExpression['arguments'][number]>[]
}

type ClassDecoratorNodeWrapper = BaseDecoratorNodeWrapper 
	& Pick<DecoratorTransformContext<TransformType.Class>, 'node' | 'targetNode'>
	& { kind: 'class' }

type MethodDecoratorNodeWrapper = BaseDecoratorNodeWrapper
	& Pick<DecoratorTransformContext<TransformType.Method>, 'node' | 'targetNode'>
	& { kind: 'method' }

type ParamDecoratorNodeWrapper = BaseDecoratorNodeWrapper
	& Pick<DecoratorTransformContext<TransformType.Param>, 'node' | 'targetNode'>
	& { kind: 'param' }
	
export type DecoratorNodeWrapper = BaseDecoratorNodeWrapper & (
	| ClassDecoratorNodeWrapper
	| MethodDecoratorNodeWrapper
	| ParamDecoratorNodeWrapper
);


class Transformer {
	transformDecorator(wrapper: DecoratorNodeWrapper) {
		let definitions = decorators;
		let lastDef!: DecoratorDefinition | undefined;

		const handleName = (part: string) => {
			lastDef = definitions.find(d => d.name == part);
			definitions = lastDef?.children ?? [];
		}

		Array.isArray(wrapper.name)
			? wrapper.name.forEach(handleName)
			: handleName(wrapper.name)
 
		if(!lastDef) return;
			
		const transform = lastDef.transform!;

		const base = {
			id: wrapper.id,
			params: wrapper.params,
			graph: this.compiler.graph, 
			analyzer: this.compiler.analyzer, 
		}; 

		if (typeof transform != "object") return void(transform.call(this, {
			...base,
			node: wrapper.node, 
			targetNode: wrapper.targetNode, 
		}));

		const transformSpecific = transform[wrapper.kind];
		if(!transformSpecific) return;

		return transformSpecific.call(this, {
			...base,
			node: wrapper.node,
			targetNode: wrapper.targetNode
		} as any);
	}

	async transformService(path: string, source: string) {
		const ast = await this.compiler.analyzer.analyzeService(path, source!);
		if(!ast) return;
		
		source = this.compiler.codegen.generateCode(ast);

		// TODO: add file é realmente necessário?
		this.compiler.graph.addFile(path, source);
	}

	async transformCommand(path: string, code: string) {
		const node = this.compiler.analyzer.analyzeCommand(path, code);
		if(!node) return;

		const { transformImportDeclarationToDynamic } = this;

		const map = {
			async ImportDeclaration(path: NodePath<T.ImportDeclaration>) {
				transformImportDeclarationToDynamic(path);
			},

			EnumDeclaration(node: NodePath<T.EnumDeclaration>) {
				throw new FlameError('Cannot use enum in command', getErrorLocation(node, path));
			},

			ClassDeclaration(node: NodePath<T.ClassDeclaration>) {
				throw new FlameError('Cannot use class in command', getErrorLocation(node, path));
			},

			ExportNamedDeclaration(node: NodePath<T.ExportNamedDeclaration>) {
				if (node.get('specifiers').length == 0) return;

				throw new FlameError('Cannot export in command', getErrorLocation(node, path));
			},

			ExportDefaultDeclaration(path: NodePath<T.ExportDefaultDeclaration>) {
				path.replaceWith(T.returnStatement(path.node.declaration as T.Expression));
			}
		}

		for(const child of node.get("body")) map[child.type](child);

		this.compiler.graph.addCommand(node);
	}

	transformImportDeclarationToDynamic(path: NodePath<T.ImportDeclaration>) {
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

	constructor(private compiler: Compiler) {}
}

export default Transformer;
