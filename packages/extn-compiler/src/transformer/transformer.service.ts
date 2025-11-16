import * as T from '@babel/types';
import { NodePath } from "@babel/traverse";
import { DecoratorDefinition } from "../def/base";
import decorators from "../def/decorators";
import Graph from "../graph";
import { throw_expr, FileTypes } from '@extn/shared';
import { NodeObserver, ObserverContext } from '../parser';
import { ObserveNode } from '@utils/decorators';
import Analyzer from '../analyzer';

export class ServiceTransformer {
	constructor(private observer: NodeObserver, private graph: Graph, private analyzer: Analyzer) {}
	
	@ObserveNode("Decorator")
	transformDecorator({ path, node, type }: ObserverContext<T.Decorator>) {
		if(type != FileTypes.Service) return;

		let definitions = decorators;
		let params = new Array<NodePath<T.ArgumentPlaceholder | T.SpreadElement | T.Expression>>;
		let lastDef!: DecoratorDefinition | undefined;

		let expr = node.get('expression');

		while(expr) {
			if(expr.isMemberExpression()) {
				const { name } = (expr.get('object') as NodePath<T.Identifier>).node;
				lastDef = definitions.find(d => d.name == name);
				definitions = lastDef?.children ?? [];

				expr = expr.get('property') as NodePath<T.Expression>;
			}

			if(expr.isCallExpression()) {
				const { name } = (expr.get('callee') as NodePath<T.Identifier>).node;
				lastDef = definitions.find(d => d.name == name);
				definitions = lastDef?.children ?? [];
				
				params = expr.get('arguments');
			}

			if(expr.isIdentifier()) {
				const name = expr.node.name;
				lastDef = definitions.find(d => d.name == name);
				definitions = lastDef?.children ?? [];
			}
		}

		if (!lastDef) return;

		const transform = lastDef.transform!;

		const self = {
			graph: this.graph,
			analyzer: this.analyzer,
		}
		
		const base = {
			path,
			params,
			graph: this.graph,
		};

		const targetNode = node.parentPath;

		const kind: string = {
			ClassDeclaration: "class",
			ClassMethod: "method",
			Identifier: "param"
		}[targetNode.node.type] ?? throw_expr(new Error("Unknown decorator"));

		if (typeof transform != "object") return void (transform.call(self, {
			...base,
			node,
			targetNode: node.parentPath as any,
		}));

		const transformSpecific = transform[kind];
		if (!transformSpecific) return;

		return transformSpecific.call(self, {
			...base,
			node,
			targetNode
		} as any);
	}
}