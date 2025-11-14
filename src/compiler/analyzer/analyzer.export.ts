import * as T from "@babel/types";
import Graph from "../graph";
import { resolveNodeId } from "@utils/resolve-node-id";
import { ZenError, getErrorLocation } from "@reporter";
import { NodeObserver, ObserverContext } from "../parser";
import { ObserveNode } from "@utils/decorators";
import { FileTypes } from "@consts";

export class ExportAnalyzer {
	constructor(private observer: NodeObserver, private graph: Graph) {}

	@ObserveNode("ExportNamedDeclaration")
	analyzeExportNamed(ctx: ObserverContext<T.ExportNamedDeclaration>) {
		const { node, path, type } = ctx;

		if(type ==  FileTypes.Command) {
			if (node.get('specifiers').length == 0) return;

			throw new ZenError('Cannot export in command', getErrorLocation(node, path));
		} else {
			const decl = node.get('declaration');
			if(!decl.isDeclaration() || decl.isEnumDeclaration()) return;
	
			const id = resolveNodeId(decl).node.name;
			
			this.graph.addSymbol({
				id,
				path,
				node,
				kind: node.type,
			});
		}
	}
}