import { Client } from "discord.js";
import { ClassLike, DependencyInjectorResolver } from "./resolver";
import { DependencyBridge } from "./bridge";

class DependencyManager {
    private DIResolver: DependencyInjectorResolver;
    
    async load(graph: any) {
		await this.DIResolver.parseGraph(graph);
		await this.DIResolver.resolve();
    }

    getInstanceFrom<E extends ClassLike>(entity: E): E {
        return this.DIResolver.instanceFromDependency.get(entity);
    }

	addDependency(d: ClassLike) {
		this.DIResolver.addLooseDependency(d);
	}

    constructor(client: Client) {
		DependencyBridge.connect(this.getInstanceFrom.bind(this));
        this.DIResolver = new DependencyInjectorResolver(client);
    }
}

export default DependencyManager;