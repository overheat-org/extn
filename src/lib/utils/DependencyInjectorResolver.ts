import { Client } from "discord.js";
import { FlameClient } from "../structures";
import { FORWARD_SYMBOL } from "../../consts";

export type ClassLike = new (...args: any[]) => any;
type Injectable = { entity: ClassLike; dependencies: ClassLike[] };

class ClassMap<V> extends Map<ClassLike, V> {
    get(key: ClassLike) {
        return super.get(key.name as any);
    }
    delete(key: ClassLike): boolean {
        return super.delete(key.name as any);
    }
    has(key: ClassLike): boolean {
        return super.has(key.name as any);
    }
    set(key: ClassLike, value: any): this {
        return super.set(key.name as any, value);
    }
}

// TODO: Make it analyze each dependency at the same time without forward bugs
export class DependencyInjectorResolver {
    private processingStack = new Set<ClassLike>();
    public instanceFromDependency = new ClassMap<any>();
    private dependenciesFromEntity = new ClassMap<ClassLike[]>();
    private unresolvedDependencies = new Set<ClassLike>();

    constructor(client: Client) {
        this.instanceFromDependency.set(Client, client);
        this.instanceFromDependency.set(FlameClient, client);
    }

    private register(entity: ClassLike, dependencies: ClassLike[] = []) {
        if (!this.dependenciesFromEntity.has(entity)) {
            this.dependenciesFromEntity.set(entity, dependencies);
            this.unresolvedDependencies.add(entity);
        }
    }

    async resolve(): Promise<void> {
        for (const dep of Array.from(this.unresolvedDependencies)) {
            await this.resolveDependency(dep);
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
            throw new Error(`cycle detected at: ${entity.name}`)
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

    [Symbol.dispose]() {
        this.processingStack.clear();
        this.dependenciesFromEntity.clear();
        this.instanceFromDependency.clear();
        this.unresolvedDependencies.clear();
    }
}