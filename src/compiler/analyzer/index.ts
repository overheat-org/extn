import _traverse, { NodePath } from "@babel/traverse";
import * as T from "@babel/types";
import { parse } from '@babel/parser';
import { DecoratorAnalyzer } from './analyzer.decorator';
import { DependencyAnalyzer } from './analyzer.dependency';
import { ImportAnalyzer } from "./analyzer.import";
import Compiler from "..";
import { ExportAnalyzer } from "./analyzer.export";

const traverse = ('default' in _traverse ? _traverse.default : _traverse) as typeof _traverse;

export enum HttpBasedErrors {
	ROUTE_EXPECTED,
	ROUTE_PATH_STRING_EXPECTED
}

type CallbackObserver = (path: string, node: NodePath<any>) => unknown;

export class NodeObserver {
	private map = new Map<T.Node['type'], CallbackObserver[]>;
	
	on(type: T.Node['type'], callback: CallbackObserver) {
		let result = this.map.has(type) 
			? this.map.get(type)!
			: [];

		result.push(callback);

		this.map.set(type, result);
	}

	async emit(path: string, node: NodePath) {
		if(!this.map.has(node.type)) return;
		
		for(const handler of this.map.get(node.type)!) {
			await handler(path, node);
		}
	}
}

/** @internal */
class Analyzer {
	private decoratorAnalyzer: DecoratorAnalyzer;
	private dependencyAnalyzer: DependencyAnalyzer;

	private observer = new NodeObserver();

	analyzeCommand(id: string, code: string) {
		return parseContent(id, code);
	}

	async analyzeService(path: string, code: string) {
		const ast = parseContent(path, code);
		const tasks = new Array<Promise<void>>;

		traverse(ast, {
			enter: node => tasks.push(
				this.observer.emit(path, node)
			)
		});

		await Promise.all(tasks);

		return ast;
	}

	analyzeClassDependencies(id: string, node: NodePath<T.ClassDeclaration>) {
		return this.dependencyAnalyzer.analyzeClassDeclaration(id, node);
	}

	analyzeHttpRoute(node: NodePath<T.Decorator>, params: any) {
		return this.decoratorAnalyzer.analyzeHttpBased(node, params);
	}

	constructor(compiler: Compiler) {
		const importAnalyzer = new ImportAnalyzer(compiler);
		this.decoratorAnalyzer = new DecoratorAnalyzer(this.observer, compiler);
		this.dependencyAnalyzer = new DependencyAnalyzer(importAnalyzer);
		new ExportAnalyzer(this.observer, compiler.graph);
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
