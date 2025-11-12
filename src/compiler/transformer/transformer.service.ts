import * as T from '@babel/types';
import { NodePath } from "@babel/traverse";
import { DecoratorDefinition } from "../../def/base";
import decorators from "../../def/decorators";
import Graph from "../graph";
import NodeChannels from "../node-observer";
import { throw_expr } from '../../utils';

export class ServiceTransformer {
	constructor(nodes: NodeChannels, private graph: Graph) {
		nodes.services.on("Decorator", this.transformDecorator);
	}
	
	transformDecorator(path: string, node: NodePath<T.Decorator>) {
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

		if (typeof transform != "object") return void (transform.call(this, {
			...base,
			node,
			targetNode: node.parentPath as any,
		}));

		const transformSpecific = transform[kind];
		if (!transformSpecific) return;

		return transformSpecific.call(this, {
			...base,
			node,
			targetNode
		} as any);
	}
}