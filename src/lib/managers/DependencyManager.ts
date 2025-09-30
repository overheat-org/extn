import { Client } from "discord.js";
import { ClassLike, DependencyInjectorResolver } from "../utils/DependencyInjectorResolver";
import ManifestManager from "./ManifestManager";
import { ManifestType } from "../../consts";

class DependencyManager extends ManifestManager {
    private DIResolver: DependencyInjectorResolver;
    
    async load() {
		const graph = this.manifest[ManifestType.DependenciesGraph];
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
		super();
        this.DIResolver = new DependencyInjectorResolver(client);
    }
}

export default DependencyManager;