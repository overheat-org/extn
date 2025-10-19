import { NodePath } from "@babel/traverse";
import * as T from "@babel/types";
import { NodeObserver } from ".";
import Graph from "../../graph";
import { resolveNodeId } from "../../utils";

export class ExportAnalyzer {
	constructor(observer: NodeObserver, private graph: Graph) {
		observer.on('ExportNamedDeclaration', this.analyzeExportNamedDecl)
	}

	analyzeExportNamedDecl(path: string, node: NodePath<T.ExportNamedDeclaration>) {
		const decl = node.get('declaration');
		if(!decl.isDeclaration()) return;

		const id = resolveNodeId(decl).node.name;
		
		this.graph.addSymbol({
			id,
			path,
			node,
			kind: node.type,
		});
	}
}