import * as T from '@babel/types'; 
import { NodePath } from "@babel/traverse";
import { HttpBasedErrors, NodeObserver } from '.';
import Compiler from '..';

export class DecoratorAnalyzer {
	constructor(observer: NodeObserver, private compiler: Compiler) {
		observer.on('Decorator', this.analyzeDecorator);
	}
	
	async analyzeDecorator(path: string, node: NodePath<T.Decorator>) {
		const target = node.parentPath;
		let name!: string | string[];
		let params = new Array<NodePath<T.CallExpression['arguments'][number]>>;

		const typeMap = {
			Identifier(path: NodePath<T.Identifier>) {
				const _name = path.node.name;

				if (Array.isArray(name)) name.push(_name);
				else if (typeof name == 'string') name = [name, _name];
				else name = _name;
			},
			MemberExpression(path: NodePath<T.MemberExpression>) {
				const object = path.get('object');
				typeMap[object.node.type](object);

				const property = path.get('property');
				typeMap[property.node.type](property);
			},
			CallExpression(path: NodePath<T.CallExpression>) {
				const callee = path.get('callee');
				typeMap[callee.node.type](this);
				params = path.get("arguments");
			}
		}

		const expr = node.get('expression');
		const handler = typeMap[expr.node.type];
		if (!handler) return;
		
		handler(expr);

		const targetMap = {
			ClassDeclaration: "class",
			ClassMethod: "method",
			Identifier: "param"
		}

		await this.compiler.transformer.transformDecorator({
			id: path,
			name,
			targetNode: target as any,
			params,
			node: node,
			kind: targetMap[target.node.type]
		})
	}

	analyzeHttpBased(node: NodePath<T.Decorator>, params: any) {
		const [routeParam] = params;

		if (!routeParam) return HttpBasedErrors.ROUTE_EXPECTED;
		if (!routeParam.isStringLiteral()) return HttpBasedErrors.ROUTE_PATH_STRING_EXPECTED;

		return { endpoint: routeParam.node.value }
	}
}