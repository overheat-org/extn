import * as T from '@babel/types';
import { PluginContext, EmittedFile } from '';
import Graph from './graph';
import { Symbol } from './graph';
import template from '@babel/template'
import _generate from '@babel/generator';
import { ManifestType } from './consts';

const generate = ('default' in _generate ? _generate.default : _generate) as typeof _generate;

class CodeGenerator {
	private generators = {
		manifest: () => this.generateManifest(),
		commands: () => this.generateCommands(),
		index: () => this.generateMain()
	}

	generate(id: string) {
		return this.generators[id]();
	}

	private generateMain() {
		return `
			import { FlameClient } from '@flame-oh/core';

			process.env = {
				...process.env,
			}

			const client = new FlameClient({
				entryUrl: import.meta.url,
			});

			client.start();
		`;
	}

	private generateManifest() {
		const allItems = [
			{
				key: ManifestType.Routes,
				items: this.graph.routes
			},
			{
				key: ManifestType.DependenciesGraph,
				items: [...this.graph.modules, ...this.graph.managers, ...this.graph.injectables]
			},
			{
				key: ManifestType.Events,
				items: this.graph.events
			},
			{
				key: ManifestType.Modules,
				items: this.graph.modules
			}
		];

		const tracked = new Set<Symbol>();
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

	private generateCommands() {
		const registrations = Array.from(this.graph.commands).map(m =>
			template.statement(`
				__container__.add(async () => {
					%%body%%
				});
			`)({
				body: m.content.program.body
			})
		);

		const ast = T.file(
			T.program([
				...template.statements(`
					import { createElement as _jsx, Fragment as _Frag } from 'diseact/jsx-runtime';
					import { CommandContainer } from '@flame-oh/core';
				
					const __container__ = new CommandContainer();
				`)(),
				...registrations,
				template.statement(`export default __container__;`)()
			])
		);

		return this.generateCode(ast);
	}

	private generateImportDeclaration(symbol: Symbol) {
		const id = T.identifier(symbol.id);

		return T.importDeclaration(
			[T.importSpecifier(id, id)],
			T.stringLiteral(symbol.path)
		);
	}

	private generateCode(ast: T.Node) {
		return generate(ast).code;
	}

	constructor(private graph: Graph) { }
}

export default CodeGenerator;