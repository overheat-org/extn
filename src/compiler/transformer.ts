import * as T from "@babel/types";
import { NodePath } from "@babel/traverse";
import Analyzer from "./analyzer";
import Graph from "../graph";
import decorators from "../def/decorators";
import { DecoratorDefinition, DecoratorTransform, DecoratorTransformContext, TransformType } from "../def/base";
import { FlameError, getErrorLocation } from "../reporter";
import fs from 'fs/promises';
import CodeGenerator from "./codegen";

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


/** @internal */
class Transformer {
	private analyzer: Analyzer;

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
			id: wrapper.id,
			params: wrapper.params,
			graph: this.graph, 
			analyzer: this.analyzer, 
		}; 

		if (typeof transform != "object") return void(transform.call(this, {
			...base,
			node: wrapper.node, 
			targetNode: wrapper.targetNode, 
		}));

		transform[wrapper.kind]?.call(this, {
			...base,
			node: wrapper.node,
			targetNode: wrapper.targetNode
		});
	}

	async transformService(path: string, code: string) {
		if(!code) code = await fs.readFile(path, 'utf-8');
		
		const analyzerResult = await this.analyzer.analyzeService(path, code!);
		
		await Promise.all(analyzerResult.decorators.map(this.transformDecorator));
		
		if(!analyzerResult.ast) return code;
		return this.codegen.generateCode(analyzerResult.ast!.node);
	}

	async transformCommand(path: string, code: string) {
		const node = this.analyzer.analyzeCommand(path, code);
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

		this.graph.addCommand(node);
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

	constructor(public graph: Graph, private codegen: CodeGenerator) {
		this.analyzer = new Analyzer(this.graph);
	}
}

export default Transformer;
