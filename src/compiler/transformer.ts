import * as T from '@babel/types';
import { PluginItem, transformFromAstAsync } from '@babel/core';
import _traverse, { NodePath, Visitor } from "@babel/traverse";
import Config from '../config';
import { CommandModule, Module } from './module';
import { toDynamicImport } from './utils';
import decorators from './decorators';
import Graph from './graph';

export type DecoratorDeclaration = (this: { module: Module, graph: Graph }, path: NodePath<T.Decorator>) => unknown;

abstract class BaseTransformer  {
	plugins: PluginItem[] = [];
	presets: PluginItem[] = [];

	protected getVisitor(module: Module): Visitor {
		return {}
	}

	async transformModule(module: Module) {
		const visitorPlugin = { visitor: this.getVisitor(module) };

		const result = await transformFromAstAsync(module.content, undefined, {
			plugins: [visitorPlugin, ...this.plugins],
			presets: this.presets,
			filename: module.filename,
			ast: true
		});

		if (!result || !result.ast) throw new Error("Transformation failed");

		module.content = result.ast;
	}

	constructor(protected config: Config, protected graph: Graph) {}
}

export class ModuleTransformer extends BaseTransformer {
	presets: PluginItem[] = [
		"@babel/preset-typescript",
		["@babel/preset-react", { runtime: "automatic", importSource: "diseact" }],
	]

	public transformImportSource(path: NodePath<T.ImportDeclaration>, module: Module, parent: string) {
		const relativePath = Module.pathToRelative(module.buildPath, parent);
		path.get('source').set('value', relativePath);
	}

	public async transformDecorator(path: NodePath<T.Decorator>, module: Module) {
		const expr = path.node.expression;
		let callback: DecoratorDeclaration | undefined;

		switch (true) {
			case T.isIdentifier(expr): {
				callback = decorators[expr.name];
				break;
			}
			case T.isCallExpression(expr)
				&& T.isMemberExpression(expr.callee)
				&& T.isIdentifier(expr.callee.object): {
				callback = decorators[expr.callee.object.name];
				break;
			}
		}

		if (!callback) return;

		const context = {
			module,
			graph: this.graph
		};
		
		callback.bind(context)(path);

		if (!path.removed) path.remove();
	}
}

export class CommandTransformer extends BaseTransformer {
	protected getVisitor(m: Module): Visitor {
		return {
			ExportDefaultDeclaration: this.transformExportDefaultDeclaration,
			ExportNamedDeclaration: this.transformExportNamedDeclaration,
		}
	}
	
	presets: PluginItem[] = [
		"@babel/preset-typescript",
		["@babel/preset-react", { pragma: "_jsx", pragmaFrag: "_Frag" }]
	]

	async transformImportSource(path: NodePath<T.ImportDeclaration>, module?: Module) {		
		if(path.removed) return;
		
		if(module) {
			const relativePath = Module.pathToRelative(module.buildPath, this.config.buildPath);
			path.get('source').set('value', relativePath);
		}

		toDynamicImport(path);
	}

	private transformExportNamedDeclaration(path: NodePath<T.ExportNamedDeclaration>) {
		path.remove();
	}
	
	private transformExportDefaultDeclaration(path: NodePath<T.ExportDefaultDeclaration>) {
		path.replaceWith(T.returnStatement(path.node.declaration as T.Expression));
	}
};


export class Transformer {
	public command: CommandTransformer;
	public module: ModuleTransformer;
	
	async transformModule(module: Module | CommandModule) {
		return this[module instanceof CommandModule ? 'command' : 'module'].transformModule(module);
	}

	constructor(config: Config, graph: Graph) {
		this.command = new CommandTransformer(config, graph);
		this.module = new ModuleTransformer(config, graph);
	}
}

export default Transformer;
