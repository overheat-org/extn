import { DependencyAnalyzer } from './analyzer.dependency';
import { ImportAnalyzer } from "./analyzer.import";
import { ExportAnalyzer } from "./analyzer.export";
import Graph from "../graph";
import Scanner from "../scanner";
import Parser from "../parser";
import { DecoratorTransformContext, TransformType } from '../../../src/def/base';

export enum HttpBasedErrors {
	ROUTE_EXPECTED,
	ROUTE_PATH_STRING_EXPECTED
}

class Analyzer {
	private dependencyAnalyzer: DependencyAnalyzer;
	
	analyzeClassDependencies(ctx: DecoratorTransformContext<TransformType.Class>) {
		return this.dependencyAnalyzer.analyzeClassDeclaration(ctx.path, ctx.node as any);
	}

	analyzeHttpRoute(ctx: DecoratorTransformContext<TransformType.Method>) {
		const [routeParam] = ctx.params;

		if (!routeParam) return HttpBasedErrors.ROUTE_EXPECTED;
		if (!routeParam.isStringLiteral()) return HttpBasedErrors.ROUTE_PATH_STRING_EXPECTED;

		return { endpoint: routeParam.node.value }
	}

	constructor(graph: Graph, scanner: Scanner, parser: Parser) {
		const observer = parser.observe();
		const importAnalyzer = new ImportAnalyzer(observer, graph, scanner);
		this.dependencyAnalyzer = new DependencyAnalyzer(importAnalyzer);
		new ExportAnalyzer(observer, graph);
	}
}

export default Analyzer;
