import { NodePath } from "@babel/traverse";
import * as T from "@babel/types";
import Graph from "../graph";
import { resolveNodeId } from "../../utils";
import { ZenError, getErrorLocation } from "../../reporter";
import NodeChannels from "../node-observer";

export class ExportAnalyzer {
	constructor(nodes: NodeChannels, private graph: Graph) {
		nodes.services.on('ExportNamedDeclaration', this.service$analyzeExportNamed);
		nodes.commands.on('ExportNamedDeclaration', this.command$analyzeExportNamed);
		nodes.commands.on('ExportDefaultDeclaration', this.command$analyzeExportDefault);
	}

	command$analyzeExportDefault(path: string, node: NodePath<T.ExportDefaultDeclaration>) {
		
	}

	service$analyzeExportNamed(path: string, node: NodePath<T.ExportNamedDeclaration>) {
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

	command$analyzeExportNamed(path: string, node: NodePath<T.ExportNamedDeclaration>) {
		if (node.get('specifiers').length == 0) return;

		throw new ZenError('Cannot export in command', getErrorLocation(node, path));
	}
}