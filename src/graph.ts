import { NodePath } from "@babel/traverse"
import { resolveNodeId } from "./utils"

interface Event {
    symbol: Symbol
    type: string
    once: boolean
}

interface Route {
    symbol: Symbol
    endpoint: string
    method: string
    ipc: boolean
}

interface Manager {
    symbol: Symbol
    dependencies: Symbol[]
}

interface Injectable {
    symbol: Symbol
    dependencies: Symbol[]
}

export interface Symbol {
    kind: string
    id: string
    node: NodePath
	path: string
    parent?: Symbol
}

/** @internal */
class Graph {
    private symbolsByModule = new Map<string, Set<WeakRef<Symbol>>>();
    private symbolsByKey = new Map<string, WeakRef<Symbol>>();

    private getSymbolKey(symbol: Symbol): string {
        return `${symbol.node}:${symbol.id}`;
    }

    addSymbol(symbol: Symbol) {
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

    resolveSymbol(symbol: Symbol | NodePath, parent?: Symbol | NodePath) {
        if(symbol instanceof NodePath) {
            symbol = this.resolveSymbolFromNode(symbol);
        }

        if(parent instanceof NodePath) {
            parent = this.resolveSymbolFromNode(parent);
        }

        const key = this.getSymbolKey(symbol);
        const existing = this.symbolsByKey.get(key)?.deref();
        if(existing && parent) existing.parent = parent;
        
        return existing ?? this.addSymbol({ ...symbol, parent });
    }

    private resolveSymbolFromNode(node: NodePath) {
        const symbol: Symbol = {
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

        const validSymbols: Symbol[] = [];
        for (const ref of set) {
            const symbol = ref.deref();
            if (symbol) validSymbols.push(symbol);
            else set.delete(ref);
        }

        return validSymbols;
    }

    _injectables = new Set<Injectable>;

	get injectables(): Readonly<Set<Injectable>> {
		return this._injectables;
	}

    addInjectable(symbol: Symbol, dependencies: Symbol[]) {
        this._injectables.add({ symbol, dependencies });
    }

    private _managers = new Set<Manager>;

	get managers(): Readonly<Set<Manager>> {
		return this._managers;
	}

    addManager(symbol: Symbol, dependencies: Symbol[]) {
        this._managers.add({ symbol, dependencies });
    }

    _routes = new Set<Route>;

	get routes(): Readonly<Set<Route>> {
		return this._routes;
	}

    addRoute(route: Route) {
        this._routes.add(route);
    }

    _events = new Set<Event>;

	get events(): Readonly<Set<Event>> {
		return this._events;
	}

    addEvent(event: Event) {
        this._events.add(event);
    }

	_commands = new Set<unknown>();

	get commands(): Readonly<Set<unknown>> {
		return this._commands;
	}
	
	addCommand(command: unknown) {
		this._commands.add(command);
	}
}

export default Graph;

