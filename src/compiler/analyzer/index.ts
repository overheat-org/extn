import _traverse, { NodePath } from "@babel/traverse";
import * as T from "@babel/types";
import { parse } from '@babel/parser';
import { DecoratorAnalyzer } from './analyzer.decorator';
import { DependencyAnalyzer } from './analyzer.dependency';
import Transformer from "../transformer";
import Graph from "@/graph";

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

	async analyzeModule(id: string, code: string) {
		if(!this.decoratorAnalyzer.CONTENT_REGEX.test(code)) return;

		const ast = parseContent(id, code);
		
		await this.decoratorAnalyzer.analyze(id, ast);

		return ast;
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
