import * as T from '@babel/types';
import Graph, { GraphSymbol } from './graph';
import _generate from '@babel/generator';
import { PluginContext } from 'rollup';
import { ManifestType } from '@runtime/manifest';

const generate = ('default' in _generate ? _generate.default : _generate) as typeof _generate;

class CodeGenerator {
	generateIndex() {
		return `
			import { ZenClient } from 'zencord';

			process.env = {
				...process.env,
			}

			const client = new ZenClient({
				entryUrl: import.meta.url,
			});

			client.start();
		`;
	}

	generateManifest() {
		const allItems = [
			{
				key: ManifestType.Routes,
				items: this.graph.routes
			},
			{
				key: ManifestType.Dependencies,
				items: [...this.graph.modules, ...this.graph.services, ...this.graph.injectables]
			},
			{
				key: ManifestType.Events,
				items: this.graph.events
			},
		];

		const tracked = new Set<GraphSymbol>();
		const output: Record<string, T.ObjectExpression[]> = {};

		for (const group of allItems) {
			for (const item of group.items) {
				(output[group.key] ??= []).push(item.toAST());
				for (const s of item.getSymbols()) tracked.add(s);
			}
		}

		const imports = [...tracked].map(s => this.generateImportDeclaration(s));

		const ast = T.file(
			T.program([
				...imports,
				T.exportDefaultDeclaration(
					T.objectExpression(
						Object.entries(output).map(([k, v]) =>
							T.objectProperty(T.identifier(k), T.arrayExpression(v))
						)
					)
				)
			])
		);

		return this.generateCode(ast);
	}

	emitCommands(ctx: PluginContext) {
		// const registrations = Array.from(this.graph.commands).map(m =>
		// 	template.statement(`
		// 		__container__.add(async () => {
		// 			%%body%%
		// 		});
		// 	`)({
		// 		body: m.get('body')
		// 	})
		// );

		// const ast = T.file(
		// 	T.program([
		// 		...template.statements(`
		// 			import { createElement as _jsx, Fragment as _Frag } from 'diseact/jsx-runtime';
		// 			import { CommandContainer } from '@flame-oh/core';
				
		// 			const __container__ = new CommandContainer();
		// 		`)(),
		// 		...registrations,
		// 		template.statement(`export default __container__;`)()
		// 	])
		// );

		// ctx.emitFile({
		// 	type: 'asset',
		// 	source: this.generateCode(ast),
		// 	fileName: 'commands.js'
		// });
	}

	private generateImportDeclaration(symbol: GraphSymbol) {
		const id = T.identifier(symbol.id);

		return T.importDeclaration(
			[T.importSpecifier(id, id)],
			T.stringLiteral(symbol.path)
		);
	}

	generateCode(ast: T.Node) {
		return generate(ast).code;
	}

	constructor(private graph: Graph) { }
}

export default CodeGenerator;