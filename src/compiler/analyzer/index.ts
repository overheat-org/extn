import _traverse, { NodePath } from "@babel/traverse";
import * as T from "@babel/types";
import { parse } from '@babel/parser';
import { DependencyAnalyzer } from './analyzer.dependency';
import { ImportAnalyzer } from "./analyzer.import";
import { ExportAnalyzer } from "./analyzer.export";
import NodeChannels from "../node-observer";
import Graph from "../graph";
import Scanner from "../scanner";

const traverse = ('default' in _traverse ? _traverse.default : _traverse) as typeof _traverse;

export enum HttpBasedErrors {
	ROUTE_EXPECTED,
	ROUTE_PATH_STRING_EXPECTED
}

/** @internal */
class Analyzer {
	private observers = new NodeChannels();
	private dependencyAnalyzer: DependencyAnalyzer;

	async analyzeCommand(path: string, code: string) {
		const ast = parseContent(path, code);
		const tasks = new Array<Promise<void>>;

		traverse(ast, {
			enter: node => tasks.push(
				this.observers.commands.emit(path, node)
			)
		});

		await Promise.all(tasks);

		return ast;
	}

	async analyzeService(path: string, code: string) {
		const ast = parseContent(path, code);
		const tasks = new Array<Promise<void>>;

		traverse(ast, {
			enter: node => tasks.push(
				this.observers.services.emit(path, node)
			)
		});

		await Promise.all(tasks);

		return ast;
	}

	analyzeClassDependencies(id: string, node: NodePath<T.ClassDeclaration>) {
		return this.dependencyAnalyzer.analyzeClassDeclaration(id, node);
	}

	constructor(graph: Graph, scanner: Scanner) {
		const importAnalyzer = new ImportAnalyzer(graph, scanner);
		this.dependencyAnalyzer = new DependencyAnalyzer(importAnalyzer);
		new ExportAnalyzer(this.observers, graph);
	}
}

function parseContent(path: string, content: string) {
	const ast = parse(content, {
		sourceType: 'module',
		sourceFilename: path,
		plugins: ["decorators", "typescript", "jsx"],
		errorRecovery: true
	});

	return ast.program;
}

export default Analyzer;
