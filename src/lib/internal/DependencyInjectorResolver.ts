import { Client } from "discord.js";
import { FlameClient } from "../structures";
import { FORWARD_SYMBOL } from "../../consts";

type ClassLike = new (...args: any[]) => any;
type Injectable = { entity: ClassLike; dependencies: ClassLike[] };

export class DependencyInjectorResolver {
    private processingStack = new Set<ClassLike>();
    private instanceFromDependency = new Map<ClassLike, any>();
    private dependenciesFromEntity = new Map<ClassLike, ClassLike[]>();
    private unresolvedDependencies = new Set<ClassLike>();

    constructor() {
        this.register(Client);
        this.register(FlameClient);
    }

    private register(entity: ClassLike, dependencies: ClassLike[] = []) {
        if (!this.dependenciesFromEntity.has(entity)) {
            this.dependenciesFromEntity.set(entity, dependencies);
            this.unresolvedDependencies.add(entity);
        }
    }

    async resolve(): Promise<void> {
        while (this.unresolvedDependencies.size) {
            const toResolve = Array.from(this.unresolvedDependencies);
            await Promise.all(toResolve.map(dep => this.resolveDependency(dep)));
        }
    }

    async parseGraph(graph: Injectable[]) {
        graph.forEach(({ entity, dependencies }) => this.register(entity, dependencies));
    }

    private defineForward(entity: ClassLike): () => any {
        const ref = { current: undefined };
        const forwardFn = () => ref.current;
        forwardFn[FORWARD_SYMBOL] = true;
        this.instanceFromDependency.set(entity, ref);
        return forwardFn;
    }

    private async resolveDependency(entity: ClassLike): Promise<any> {
        if (this.instanceFromDependency.has(entity)) {
            const value = this.instanceFromDependency.get(entity);
            return typeof value === "object" && "current" in value ? value.current : value;
        }

        if (this.processingStack.has(entity)) {
            return this.defineForward(entity);
        }

        this.processingStack.add(entity);
        const deps = this.dependenciesFromEntity.get(entity) || [];
        const params = await Promise.all(deps.map(d => this.resolveDependency(d)));
        const instance = new entity(...params);

        const existing = this.instanceFromDependency.get(entity);
        if (typeof existing === "object" && existing && "current" in existing) {
            existing.current = instance;
        } else {
            this.instanceFromDependency.set(entity, instance);
        }

        this.unresolvedDependencies.delete(entity);
        this.processingStack.delete(entity);

        return instance;
    }

    [Symbol.dispose](): void {
        this.processingStack.clear();
        this.dependenciesFromEntity.clear();
        this.instanceFromDependency.clear();
        this.unresolvedDependencies.clear();
    }
}