import { DependencyInjectorResolver } from "./DependencyInjectorResolver";

class DependencyManager {
    private DIResolver = new DependencyInjectorResolver();
    
    async resolve(buildPath: string) {
        try {
            const { default: graph } = await import(`${buildPath}/dependency-graph.js`);
            await this.DIResolver.parseGraph(graph);
            await this.DIResolver.resolve();
        } catch (err) {
            throw new Error(`Failed to load dependencies from ${buildPath}/dependency-graph.js:\n${err}`);

        }
    }
}

export default DependencyManager;