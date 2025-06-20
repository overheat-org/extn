import { transformFromAstAsync } from '@babel/core';
import _traverse, { NodePath } from "@babel/traverse";
import Config from '../config';
import { Module } from './module';
import { asyncTraverse, AsyncVisitor } from './utils';
import Graph from './graph';
import ImportResolver from './import-resolver';

export class TransformStrategy {
	visitor: AsyncVisitor = {};
	protected config!: Config;
	protected graph!: Graph;
	protected importResolver!: ImportResolver;

	constructor(protected module: Module) {
		const proto = Object.getPrototypeOf(this);
		for (const name of Object.getOwnPropertyNames(proto)) {
			if (name === "constructor") continue;

			const fn = this[name];
			if (typeof fn === "function") {
				this.visitor[name] = fn.bind(this);
			}
		}
	}

	async apply(config: Config, graph: Graph, importResolver: ImportResolver) {
		this.config = config;
		this.graph = graph;
		this.importResolver = importResolver;

		await asyncTraverse(this.module.content, this.visitor);
	}
}

export class Transformer {
	async transformModule(module: Module) {
		await module.transformStrategy.apply(this.config, this.graph, this.importResolver);
		const result = await transformFromAstAsync(module.content, undefined, {
			presets: module.transformStrategy.presets,
			filename: module.basename,
			ast: true
		});

		if (!result || !result.ast) throw new Error(`Transformation failed for module ${module.basename}`);
		module.content = result.ast;
	}

	constructor(private config: Config, private graph: Graph, private importResolver: ImportResolver) {}
}

export default Transformer;
