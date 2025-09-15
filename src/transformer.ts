import * as T from "@babel/types";
import { NodePath } from "@babel/traverse";
import Analyzer from "./analyzer";
import Graph from "./graph";
import decorators from "./definitions/decorators";
import { DecoratorDefinition, DecoratorTransform, DecoratorTransformContext, TransformType } from "./definitions/base";
import { FlameError, getErrorLocation } from "./reporter";

type BaseDecoratorNodeWrapper = {
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
	& { kind: 'param'}
	
export type DecoratorNodeWrapper = BaseDecoratorNodeWrapper & (
	| ClassDecoratorNodeWrapper
	| MethodDecoratorNodeWrapper
	| ParamDecoratorNodeWrapper
);


/** @internal */
class Transformer {
	private analyzer: Analyzer;

	async transformModule(id: string, code: string) {
		this.analyzer.analyzeModule(id, code);
	}

	public transformDecorator(node: DecoratorNodeWrapper) {
		let definitions = decorators;
		let lastDef: DecoratorDefinition | undefined = undefined;

		const handleName = (part: string) => {
			lastDef = definitions.find(d => d.name == part);
			definitions = lastDef?.children ?? [];
		}

		Array.isArray(node.name)
			? node.name.forEach(handleName)
			: handleName(node.name)

		if(!lastDef) return;
			
		this.handleTransformDecorator(
			(lastDef as DecoratorDefinition).transform!,
			node
		)
	}

	private handleTransformDecorator(transform: DecoratorTransform, wrapper: DecoratorNodeWrapper) {
		const base = { 
			graph: this.graph, 
			analyzer: this.analyzer, 
		}; 

		if (typeof transform != "object") return transform.call(this, {
			...base,
			node: wrapper.node, 
			targetNode: wrapper.targetNode, 
		});
		
		if (
			transform.class &&
			wrapper.kind == 'class'
		) {
			transform.class.call(this, { 
				...base,
				node: wrapper.node, 
				targetNode: wrapper.targetNode, 
			});
		}

		if (
			transform.method &&
			wrapper.kind == 'method'
		) {
			transform.method.call(this, { 
				...base,
				node: wrapper.node, 
				targetNode: wrapper.targetNode, 
			});
		}

		if (
			transform.param &&
			wrapper.kind == 'param'
		) {
			transform.param.call(this, { 
				...base,
				node: wrapper.node, 
				targetNode: wrapper.targetNode, 
			});
		}
	}

	public transformCommand(id: string, node: NodePath<T.Program>) {
		const { transformImportDeclarationToDynamic } = this;

		const map = {
			async ImportDeclaration(path: NodePath<T.ImportDeclaration>) {
				if (path.removed) return;

				transformImportDeclarationToDynamic(path);
			},

			EnumDeclaration(path: NodePath<T.EnumDeclaration>) {
				throw new FlameError('Cannot use enum in command', getErrorLocation(path, id));
			},

			ClassDeclaration(path: NodePath<T.ClassDeclaration>) {
				throw new FlameError('Cannot use class in command', getErrorLocation(path, id));
			},

			ExportNamedDeclaration(path: NodePath<T.ExportNamedDeclaration>) {
				const node = path.node;

				if (node.specifiers.length == 0) return;

				throw new FlameError('Cannot export in command', getErrorLocation(path, id));
			},

			ExportDefaultDeclaration(path: NodePath<T.ExportDefaultDeclaration>) {
				path.replaceWith(T.returnStatement(path.node.declaration as T.Expression));
			}
		}

		for(const child of node.get("body")) map[child.type](child);
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

	constructor(public graph: Graph) {
		this.analyzer = new Analyzer(this, this.graph);
	}
}

export default Transformer;
