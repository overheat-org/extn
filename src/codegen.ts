import * as T from '@babel/types';
import { PluginContext, EmittedFile } from 'rollup';
import Graph from './graph';
import generate from '@babel/generator';
import { Symbol } from './graph';
import template from '@babel/template'

class CodeGenerator {
	generate(ctx: PluginContext) {
		const files = [
			this.generateCommands(),
			this.generateEventsGraph(),
			this.generateRoutesGraph(),
			this.generateDependencyGraph()
		] as EmittedFile[];

		for (const file of files) ctx.emitFile(file);
	}

	generateCommands(): EmittedFile {
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

		return {
			type: "asset",
			fileName: "commands.js",
			source: this.generateCode(ast),
		};

	}

	generateEventsGraph(): EmittedFile {
		const tracked = new Set<Symbol>();
		const objects = Array.from(this.graph.events).map(r => {
			if (r.symbol.parent) tracked.add(r.symbol.parent);

			return T.objectExpression([
				T.objectProperty(T.identifier("type"), T.stringLiteral(r.type)),
				T.objectProperty(T.identifier("once"), T.booleanLiteral(r.once)),
				T.objectProperty(T.identifier("handler"), T.stringLiteral(r.symbol.id)),
				T.objectProperty(T.identifier("entity"), T.identifier(r.symbol.parent?.id ?? "undefined"))
			]);
		});

		const imports = [...tracked].map(s => this.generateImportDeclaration(s));

		const ast = T.file(
			T.program([
				...imports,
				T.exportDefaultDeclaration(T.arrayExpression(objects))
			])
		);

		return {
			type: "asset",
			fileName: "events.js",
			source: this.generateCode(ast),
		};
	}

	generateRoutesGraph(): EmittedFile {
		const tracked = new Set<Symbol>();
		const objects = new Array<T.ObjectExpression>;

		for (const r of this.graph.routes) {
			if (r.symbol.parent) tracked.add(r.symbol.parent);

			objects.push(
				T.objectExpression([
					T.objectProperty(T.identifier("endpoint"), T.stringLiteral(r.endpoint)),
					T.objectProperty(T.identifier("method"), T.stringLiteral(r.method)),
					T.objectProperty(T.identifier("ipc"), T.booleanLiteral(r.ipc)),
					T.objectProperty(T.identifier("handler"), T.stringLiteral(r.symbol.id)),
					T.objectProperty(T.identifier("entity"), T.identifier(r.symbol.parent?.id ?? "undefined"))
				])
			);
		}

		const imports = [...tracked].map(s => this.generateImportDeclaration(s));

		const ast = T.file(
			T.program([
				...imports,
				T.exportDefaultDeclaration(T.arrayExpression(objects))
			])
		);

		return {
			type: "asset",
			fileName: "routes.js",
			source: this.generateCode(ast),
		};
	}


	generateDependencyGraph(): EmittedFile {
		const tracked = new Set<Symbol>();
		const objects = Array.from(new Set([...this.graph.injectables, ...this.graph.managers])).map(i => {
			tracked.add(i.symbol);
			i.dependencies.forEach(s => tracked.add(s));

			return T.objectExpression([
				T.objectProperty(T.identifier("entity"), T.identifier(i.symbol.id)),
				T.objectProperty(
					T.identifier("dependencies"),
					T.arrayExpression(i.dependencies.map(d => T.identifier(d.id)))
				)
			]);
		});

		const imports = [...tracked].map(s => this.generateImportDeclaration(s));

		const ast = T.file(
			T.program([
				...imports,
				T.exportDefaultDeclaration(T.arrayExpression(objects))
			])
		);

		return {
			type: "asset",
			fileName: "dependency-graph.js",
			source: this.generateCode(ast),
		};
	}

	generateCode(ast: T.Node) {
		return generate(ast).code;
	}

	generateImportDeclaration(symbol: Symbol) {
		const id = T.identifier(symbol.id);

		return T.importDeclaration(
			[T.importSpecifier(id, id)],
			T.stringLiteral(symbol.path)
		);
	}

	constructor(private graph: Graph) { }
}

export default CodeGenerator;