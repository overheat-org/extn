import DependencyManager from "./DependencyManager";
import { IPCManager } from "./IPCManager";
import { HTTPManager } from "./HTTPManager";
import { ClassLike } from "../utils/DependencyInjectorResolver";

interface Endpoint {
    endpoint: string,
    method: string,
    handler: string,
    entity: ClassLike,
    ipc?: boolean
}

class CommunicationManager {
    ipcManager = new IPCManager();
    httpManager = new HTTPManager();

    async load(entryPath: string) {
        try {
            const { default: endpoints }: { default: Endpoint[] } = await import(`${entryPath}/routes.js`);
            const grouped = Object.groupBy(endpoints, e => e.ipc ? 'ipc' : 'http');

            const ipc = grouped.ipc ?? [];
            const http = grouped.http ?? [];

            this.loadEndpoints(ipc, this.ipcManager);
            this.loadEndpoints(http, this.httpManager);
        } catch (err) {
            if(err instanceof Error) {
                throw new Error(`Failed to load routes:${err.stack}`);
            }
            else {
                throw err;
            }
        }
    }

    loadEndpoints(endpoints: Endpoint[], manager: IPCManager | HTTPManager) {
        endpoints.forEach(e => {
            const instance = this.dependencyManager.getInstanceFrom(e.entity);
            const handler = instance[e.handler];

            manager[e.method](e.endpoint, handler);
        });
    }

    constructor(private dependencyManager: DependencyManager) {}
}

export default CommunicationManager;