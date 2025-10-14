import _traverse, { NodePath } from "@babel/traverse";
import * as T from "@babel/types";
import { parse } from '@babel/parser';
import { DecoratorAnalyzer } from './analyzer.decorator';
import { DependencyAnalyzer } from './analyzer.dependency';
import Graph from "../../graph";

const traverse = ('default' in _traverse ? _traverse.default : _traverse) as typeof _traverse;

export enum HttpBasedErrors {
	ROUTE_EXPECTED,
	ROUTE_PATH_STRING_EXPECTED
}

/** @internal */
class Analyzer {
	private decoratorAnalyzer: DecoratorAnalyzer;
	private dependencyAnalyzer: DependencyAnalyzer;

	analyzeCommand(id: string, code: string) {
		return parseContent(id, code);
	}

	async analyzeService(path: string, code: string) {
		if(!this.decoratorAnalyzer.test(code)) return {};

		const ast = parseContent(path, code);
		const decorators = await this.decoratorAnalyzer.analyze(path, ast);

		return {
			decorators,
			ast
		};
	}

	analyzeClassDependencies(id: string, node: NodePath<T.ClassDeclaration>) {
		return this.dependencyAnalyzer.analyze(id, node);
	}

	analyzeHttpRoute(node: NodePath<T.Decorator>, params: any) {
		return this.decoratorAnalyzer.analyzeHttpBased(node, params);
	}

	constructor(graph: Graph) {
		this.decoratorAnalyzer = new DecoratorAnalyzer();
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
