import { NodePath } from "@babel/traverse";
import * as T from "@babel/types";
import { resolveNodeId } from "../../utils";
import { basename, dirname, join } from "path";
import Scanner, { ScanType } from "../scanner";
import fs from 'fs';
import { fileURLToPath } from "url";
import Graph from "../graph";
import NodeChannels from "../node-observer";

// TODO: Talvez seja melhor fazer o scanModule retornar a lista de symbols encontrados no arquivo

export class ImportAnalyzer {
	constructor(nodes: NodeChannels, private graph: Graph, private scanner: Scanner) {
		nodes.commands.on("ImportDeclaration", this.command$analyzeImport);
	}

	async command$analyzeImport() {

	}
	
	async analyzeTypeDeclaration(path: string, node: NodePath<T.TSTypeReference>) {
		const typeName = resolveNodeId(node.get("typeName")).node.name;
		const binding = node.scope.getBinding(typeName);

		await this.analyzeBinding(path, binding?.path);

		return this.graph.findSymbol({ id: typeName, path });
	}

	analyzeBinding(path: string, node?: NodePath<T.Node>) {
		switch (node?.node.type) {
			case "ImportDefaultSpecifier":
			case "ImportSpecifier":
				return this.analyzeSpecifier(path, node);
		}
	}

	async analyzeSpecifier(path: string, specifier: NodePath<T.ImportSpecifier | T.ImportDefaultSpecifier>) {
		const importDecl = specifier.parentPath as NodePath<T.ImportDeclaration>;
		const targetPath = importDecl.node.source.value;

		const basePath = dirname(path);

		if(targetPath.startsWith('.')) {
			await this.analyzeRelativePath(basePath, targetPath);
		}
		else {
			await this.analyzePackage(targetPath);
		}
	}

	async analyzeRelativePath(basePath: string, targetPath: string) {
		let fullPath = join(basePath, targetPath);

		if(!/\.\w+$/.test(fullPath)) fullPath = await this.resolveExtension(fullPath);
		
		await this.scanner.scanFile(fullPath, ScanType.Service);
	}

	private async resolveExtension(path: string) {
		const basePath = dirname(path);
		const fileName = basename(path);
		const files = await fs.promises.readdir(basePath);

		const file = files.find(f => f === fileName || f.startsWith(fileName + "."));

		// TODO: Melhorar esse erro
		if(!file) throw new Error('Unkown file');

		return join(basePath, file);
	}

	async analyzePackage(targetPath: string) {
		const fullPath = this.importResolve(targetPath);
		let dirPath = await this.findWorkspacePath(fullPath);

		await this.scanner.scanModule(dirPath);
	}

	private importResolve(path: string) {
		const mod = import.meta.resolve(path);

		return fileURLToPath(mod);
	}

	private async findWorkspacePath(path: string): Promise<string> {
		const dir = dirname(path);
		const files = await fs.promises.readdir(dir).catch(() => [] as string[]);

		const isRoot = files.includes('package.json');

		return isRoot ? dir : await this.findWorkspacePath(dir);
	}
}