import * as T from '@babel/types';
import { NodePath } from "@babel/traverse"
import { resolveNodeId } from "./utils"

class Event {
	constructor(
		public symbol: GraphSymbol,
		public type: string,
		public once: boolean
	) { }

	toAST() {
		return T.objectExpression([
			T.objectProperty(T.identifier("type"), T.stringLiteral(this.type)),
			T.objectProperty(T.identifier("once"), T.booleanLiteral(this.once)),
			T.objectProperty(T.identifier("handler"), T.stringLiteral(this.symbol.id)),
			T.objectProperty(
				T.identifier("entity"),
				T.identifier(this.symbol.parent?.id ?? "undefined")
			)
		]);
	}

	getSymbols() {
		return this.symbol.parent ? [this.symbol.parent] : [];
	}
}


class Route {
	constructor(
		public endpoint: string,
		public method: string,
		public symbol: GraphSymbol,
		public ipc: boolean
	) { }

	toAST() {
		return T.objectExpression([
			T.objectProperty(T.identifier("endpoint"), T.stringLiteral(this.endpoint)),
			T.objectProperty(T.identifier("method"), T.stringLiteral(this.method)),
			T.objectProperty(T.identifier("ipc"), T.booleanLiteral(this.ipc)),
			T.objectProperty(T.identifier("handler"), T.stringLiteral(this.symbol.id)),
			T.objectProperty(T.identifier("entity"), T.identifier(this.symbol.parent?.id ?? "undefined"))
		])
	}

	getSymbols() {
		return this.symbol.parent ? [this.symbol.parent] : [];
	}
}

class Service {
	constructor(
		public symbol: GraphSymbol,
		public dependencies: GraphSymbol[]
	) { }

	toAST() {	
		return T.objectExpression([
			T.objectProperty(T.identifier("service"), T.identifier(this.symbol.id)),
			T.objectProperty(
				T.identifier("dependencies"),
				T.arrayExpression(this.dependencies.map(d => T.identifier(d.id)))
			)
		]);
	}

	getSymbols() {
		return [this.symbol, ...this.dependencies];
	}
}

class Injectable {
	constructor(
		public symbol: GraphSymbol,
		public dependencies: GraphSymbol[]
	) { }

	toAST() {
		return T.objectExpression([
			T.objectProperty(T.identifier("injectable"), T.identifier(this.symbol.id)),
			T.objectProperty(
				T.identifier("dependencies"),
				T.arrayExpression(this.dependencies.map(d => T.identifier(d.id)))
			)
		]);
	}

	getSymbols() {
		return [this.symbol, ...this.dependencies];
	}
}

class Module {
	constructor(
		public name: string,
		public managers: GraphSymbol[]
	) { }

	toAST() {
		return T.objectExpression([
			T.objectProperty(T.identifier("name"), T.stringLiteral(this.name)),
			T.objectProperty(T.identifier("managers"), T.arrayExpression(this.managers.map(m => T.identifier(m.id))))
		]);
	}

	getSymbols() {
		return [...this.managers];
	}
}

export interface GraphSymbol {
	kind: string
	id: string
	node: NodePath
	path: string
	parent?: GraphSymbol
}

/** @internal */
class Graph {
	private symbolsByModule = new Map<string, Set<WeakRef<GraphSymbol>>>();
	private symbolsByKey = new Map<string, WeakRef<GraphSymbol>>();

	private getSymbolKey(symbol: GraphSymbol): string {
		return `${symbol.node}:${symbol.id}`;
	}

	// fix: resolver o symbol node
	
	addSymbol(symbol: GraphSymbol) {
		const key = this.getSymbolKey(symbol);
		this.symbolsByKey.set(key, new WeakRef(symbol));

		let set = this.symbolsByModule.get(symbol.node);
		if (!set) {
			set = new Set();
			this.symbolsByModule.set(symbol.node, set);
		}
		set.add(new WeakRef(symbol));
		return symbol;
	}

	resolveSymbol(symbol: GraphSymbol | NodePath, parent?: GraphSymbol | NodePath) {
		if (symbol instanceof NodePath) {
			symbol = this.resolveSymbolFromNode(symbol);
		}

		if (parent instanceof NodePath) {
			parent = this.resolveSymbolFromNode(parent);
		}

		const key = this.getSymbolKey(symbol);
		const existing = this.symbolsByKey.get(key)?.deref();
		if (existing && parent) existing.parent = parent;

		return existing ?? this.addSymbol({ ...symbol, parent });
	}

	private resolveSymbolFromNode(node: NodePath) {
		const symbol: GraphSymbol = {
			node,
			id: resolveNodeId(node).node.name,
			kind: node.type,
			path: node.node.loc!.filename
		}

		return symbol;
	}

	getSymbolsByModule(path: string) {
		const set = this.symbolsByModule.get(path);
		if (!set) return [];

		const validSymbols: GraphSymbol[] = [];
		for (const ref of set) {
			const symbol = ref.deref();
			if (symbol) validSymbols.push(symbol);
			else set.delete(ref);
		}

		return validSymbols;
	}

	findSymbol(opts: { path: string, id: string }) {
		const set = this.symbolsByModule.get(opts.path);
		if (!set) return null;

		for (const ref of set) {
			const symbol = ref.deref();
			if (symbol && symbol.id === opts.id) return symbol;
		}
		return null;
	}

	_injectables = new Set<Injectable>;

	get injectables(): Readonly<Set<Injectable>> {
		return this._injectables;
	}

	addInjectable(symbol: GraphSymbol, dependencies: GraphSymbol[]) {
		this._injectables.add(new Injectable(symbol, dependencies));
	}

	private _services = new Set<Service>;

	get services(): Readonly<Set<Service>> {
		return this._services;
	}

	addService(symbol: GraphSymbol, dependencies: GraphSymbol[]) {
		this._services.add(new Service(symbol, dependencies));
	}

	private _routes = new Set<Route>;

	get routes(): Readonly<Set<Route>> {
		return this._routes;
	}

	addRoute(route: Pick<Route, 'symbol' | 'endpoint' | 'ipc' | 'method'>) {
		this._routes.add(new Route(route.endpoint, route.method, route.symbol, route.ipc));
	}

	private _events = new Set<Event>;

	get events(): Readonly<Set<Event>> {
		return this._events;
	}

	addEvent(event: Pick<Event, 'symbol' | 'type' | 'once'>) {
		this._events.add(new Event(event.symbol, event.type, event.once));
	}

	private _commands = new Set<NodePath<T.Program>>();

	get commands(): Readonly<Set<NodePath<T.Program>>> {
		return this._commands;
	}

	addCommand(command: NodePath<T.Program>) {
		this._commands.add(command);
	}

	private _modules = new Set<Module>();

	get modules(): Readonly<Set<Module>> {
		return this._modules;
	}

	addModule(moduleData: Pick<Module, 'name' | 'managers'>) {
		this._modules.add(new Module(moduleData.name, moduleData.managers));
	}
}

export default Graph;

