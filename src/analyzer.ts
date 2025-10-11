import _traverse, { NodePath } from "@babel/traverse";
import Graph from "./graph";
import Transformer from "./transformer";
import * as T from "@babel/types";
import { FlameError, getErrorLocation } from "./reporter";
import { parse } from '@babel/parser';

const traverse = ('default' in _traverse ? _traverse.default : _traverse) as typeof _traverse;

export enum HttpBasedErrors {
	ROUTE_EXPECTED,
	ROUTE_PATH_STRING_EXPECTED
}

class DecoratorAnalyzer {
	constructor(
		private transformer: Transformer,
	) { }

	private CONTENT_REGEX = /@[a-z][a-zA-Z]+(?=\s)/;

	async analyze(id: string, code: string) {
		if (!this.CONTENT_REGEX.test(code)) return;

		const program = parseContent(id, code);

		program.traverse({
			Decorator: path => this.analyzeDecorator(id, path)
		});
	}

	analyzeDecorator(id: string, path: NodePath<T.Decorator>) {
		const target = path.parentPath;
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

		const expr = path.get('expression');
		const handler = typeMap[expr.node.type];
		if (!handler) return;
		
		handler(expr);

		const targetMap = {
			ClassDeclaration: "class",
			ClassMethod: "method",
			Identifier: "param"
		}

		this.transformer.transformDecorator({
			id: id,
			name,
			targetNode: target as any,
			params,
			node: path,
			kind: targetMap[target.node.type],
		})
	}

	analyzeHttpBased(node: NodePath<T.Decorator>, params: any) {
		const [routeParam] = params;

		if (!routeParam) return HttpBasedErrors.ROUTE_EXPECTED;
		if (!routeParam.isStringLiteral()) return HttpBasedErrors.ROUTE_PATH_STRING_EXPECTED;

		return { endpoint: routeParam.node.value }
	}
}

class DependencyAnalyzer {
	constructor(private graph: Graph) { }

	analyze(id: string, node: NodePath<T.ClassDeclaration>) {
		return this.analyzeClass(id, node);
	}

	analyzeClass(id: string, node: NodePath<T.ClassDeclaration>) {
		const classBody = node.get('body').get('body');
		const constructor = classBody.find(m => m.isClassMethod() && m.node.kind === "constructor");

		if (!constructor) {
			return [];
		}

		return this.analyzeConstructor(id, constructor as NodePath<T.ClassMethod>);
	}

	analyzeConstructor(id: string, node: NodePath<T.ClassMethod>) {
		const params = node.get('params');

		return params.map(p => {
			if (!p.isTSParameterProperty()) {
				throw new FlameError("This parameter cannot be injectable", getErrorLocation(node, id));
			}

			return this.analyzeParameter(id, p);
		});
	}

	analyzeParameter(id: string, node: NodePath<T.TSParameterProperty>) {
		const parameter = node.get("parameter");
		const typeAnnotation = parameter.get("typeAnnotation");

		if (!typeAnnotation.isTSTypeAnnotation()) {
			throw new FlameError("Expected a type annotation for injectable parameter", getErrorLocation(node, id));
		}

		const typeRef = typeAnnotation.get("typeAnnotation");

		if (!typeRef.isTSTypeReference()) {
			throw new FlameError("Expected a injectable type reference", getErrorLocation(node, id));
		}

		return this.graph.resolveSymbol(typeRef);
	}
}


/** @internal */
class Analyzer {
	private decoratorAnalyzer: DecoratorAnalyzer;
	private dependencyAnalyzer: DependencyAnalyzer;

	analyzeCommand(id: string, code: string) {
		return parseContent(id, code);
	}

	async analyzeModule(id: string, code: string) {
		await this.decoratorAnalyzer.analyze(id, code)
	}

	analyzeClassDependencies(id: string, node: NodePath<T.ClassDeclaration>) {
		return this.dependencyAnalyzer.analyze(id, node);
	}

	analyzeHttpRoute(node: NodePath<T.Decorator>, params: any) {
		return this.decoratorAnalyzer.analyzeHttpBased(node, params);
	}

	constructor(transformer: Transformer, graph: Graph) {
		this.decoratorAnalyzer = new DecoratorAnalyzer(transformer);
		this.dependencyAnalyzer = new DependencyAnalyzer(graph);
	}
}

function parseContent(path: string, content: string) {
	const ast = parse(content, {
		sourceType: 'module',
		sourceFilename: path,
		plugins: ["decorators", "typescript", "jsx"],
		errorRecovery: true
	});

	let node!: NodePath<T.Program>;

	traverse(ast, {
		Program: n => void (node = n)
	});

	return node;
}

export default Analyzer;
