import * as T from '@babel/types';
import { CommandModule, Module, NodeModule } from "./module";

export class ModuleSymbol {
    static moduleSymbols = new Map<Module, Map<string, ModuleSymbol>>();

    readonly id: T.Identifier

    private constructor(
        public name: string,
        public module: Module,
        public parent?: ModuleSymbol
    ) {
        this.id = T.identifier(name);
    }

    static from(name: string, module: Module, parent?: ModuleSymbol): ModuleSymbol {
        let symbols = this.moduleSymbols.get(module);
        if (!symbols) {
            symbols = new Map();
            this.moduleSymbols.set(module, symbols);
        }

        if (symbols.has(name)) {
            return symbols.get(name)!;
        }

        const instance = new ModuleSymbol(name, module, parent);
        symbols.set(name, instance);
        return instance;
    }
}

class Injectable {
    constructor(
        public symbol: ModuleSymbol,
        public dependencies: ModuleSymbol[]
    ) { }
}

class Manager {
    constructor(
        public symbol: ModuleSymbol,
        public dependencies: ModuleSymbol[]
    ) { }
}

export class Route {
    constructor(
        public symbol: ModuleSymbol,
        public endpoint: string,
        public method: string,
        public ipc = false
    ) {}
}

export class Event {
    constructor(
        public symbol: ModuleSymbol,
        public type: string,
        public once = false
    ) {}
}

// TODO: registrar os symbols 
export class Graph {
    private modulesByEntry = new Map<string, Module>;
    private commandsByEntry = new Map<string, CommandModule>;
    modules = new Set<Module>;
    injectables = new Set<Injectable>;
    managers = new Set<Manager>;
    commands = new Array<CommandModule>;
    routes = new Set<Route>;
    events = new Set<Event>;

    addModule(module: Module | NodeModule): Module
    addModule(path: string, content?: T.File): Module
    addModule(...args: unknown[]) {
        let module: Module;

        if (typeof args[0] == 'string') {
            const [path, content] = args as [string, T.File | undefined];

            module = Module.from(path, content);
        }
        else {
            module = args[0] as Module;
        }

        if (module.entryPath) this.modulesByEntry.set(module.entryPath, module);
        this.modules.add(module);

        return module;
    }

    removeModule(module: Module): boolean;
    removeModule(path: string): boolean;
    removeModule(arg: string | Module): boolean {
        let path: string;
        let target: Module;

        if (typeof arg === "string") {
            path = Module.normalizePath(arg);
            target = this.modulesByEntry.get(path)!;
        } else {
            path = arg.entryPath;
            target = arg;
        }

        const removedMap = this.modulesByEntry.delete(path);
        const removedSet = this.modules.delete(target);

        return removedMap || removedSet;
    }

    getModule(path: string) {
        path = Module.normalizePath(path);

        return this.modulesByEntry.get(path);
    }

    addCommand(module: CommandModule): CommandModule
    addCommand(path: string, content?: T.File): CommandModule
    addCommand(...args: unknown[]) {
        let module: CommandModule;

        if (typeof args[0] == 'string') {
            const [path, content] = args as [string, T.File | undefined];

            module = CommandModule.from(path, content);
        } else {
            module = args[0] as CommandModule;
        }

        if (module.entryPath) this.commandsByEntry.set(module.entryPath, module);
        this.commands.push(module);

        return module;
    }

    getCommand(path: string) {
        path = Module.normalizePath(path);

        return this.commandsByEntry.get(path);
    }

    addInjectable(symbol: ModuleSymbol, dependencies: ModuleSymbol[]) {
        this.injectables.add(
            new Injectable(symbol, dependencies)
        );
    }

    addManager(symbol: ModuleSymbol, dependencies: ModuleSymbol[]) {
        this.managers.add(
            new Manager(symbol, dependencies)
        );
    }

    addRoute(route: Route) {
        this.routes.add(
            new Route(route.symbol, route.endpoint, route.method, route.ipc)
        )
    }

    addEvent(event: Event) {
        this.events.add(
            new Event(event.symbol, event.type, event.once)
        )
    }
}

export default Graph;
