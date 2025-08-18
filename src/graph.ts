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

interface Symbol {
    kind: string
    id: string
    path: string
    parent?: Symbol
}

class Graph {
    private symbolsByModule = new Map<string, Set<WeakRef<Symbol>>>();
    private symbolsByKey = new Map<string, WeakRef<Symbol>>();

    private getSymbolKey(symbol: Symbol): string {
        return `${symbol.path}:${symbol.id}`;
    }

    addSymbol(symbol: Symbol) {
        const key = this.getSymbolKey(symbol);
        this.symbolsByKey.set(key, new WeakRef(symbol));

        let set = this.symbolsByModule.get(symbol.path);
        if (!set) {
            set = new Set();
            this.symbolsByModule.set(symbol.path, set);
        }
        set.add(new WeakRef(symbol));
        return symbol;
    }

    resolveSymbol(symbol: Symbol) {
        const key = this.getSymbolKey(symbol);
        const existing = this.symbolsByKey.get(key)?.deref();
        return existing ?? this.addSymbol(symbol);
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

    private injectables = new Set<Injectable>;

    addInjectable(injectable: Injectable) {
        this.injectables.add(injectable);
    }

    private managers = new Set<Manager>;

    addManager(manager: Manager) {
        this.managers.add(manager);
    }

    commands = new Set<unknown>;

    routes = new Set<Route>;

    addRoute(route: Route) {
        this.routes.add(route);
    }

    events = new Set<Event>;

    addEvent(event: Event) {
        this.events.add(event);
    }
}

export default Graph;

