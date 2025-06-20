import { Client } from "discord.js";
import { ClassLike, DependencyInjectorResolver } from "../utils/DependencyInjectorResolver";

class DependencyManager {
    private DIResolver: DependencyInjectorResolver;
    
    async resolve(entryPath: string) {
        try {
            const { default: graph } = await import(`${entryPath}/dependency-graph.js`);
            await this.DIResolver.parseGraph(graph);
            await this.DIResolver.resolve();
        } catch (err) {
            if(err instanceof Error) {
                throw new Error(`Failed to load dependencies from dependencies graph:${err.stack}`);
            }
            else {
                throw err;
            }
        }
    }

    getInstanceFrom<E extends ClassLike>(entity: E): E {
        return this.DIResolver.instanceFromDependency.get(entity);
    }

    constructor(client: Client) {
        this.DIResolver = new DependencyInjectorResolver(client);
    }
}

export default DependencyManager;