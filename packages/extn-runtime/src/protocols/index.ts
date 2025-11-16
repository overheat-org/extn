import { IPCManager } from "./ipc";
import { HTTPManager } from "./http";
import { ClassLike } from "../di/resolver";
import DependencyManager from "../di/manager";

export interface Endpoint {
    endpoint: string,
    method: string,
    handler: string,
    entity: ClassLike,
    ipc?: boolean
}

class ProtocolsManager {
    constructor(private dependencyManager: DependencyManager) {}

    ipcManager = new IPCManager();
    httpManager = new HTTPManager();

    async load(routes: Endpoint[]) {
		const grouped = Object.groupBy(routes, e => e.ipc ? 'ipc' : 'http');

		const ipc = grouped.ipc ?? [];
		const http = grouped.http ?? [];

		this.loadEndpoints(ipc, this.ipcManager);
		this.loadEndpoints(http, this.httpManager);
    }

    loadEndpoints(endpoints: Endpoint[], manager: IPCManager | HTTPManager) {
        endpoints.forEach(e => {
            const instance = this.dependencyManager.getInstanceFrom(e.entity);
            const handler = instance[e.handler];

            manager[e.method](e.endpoint, handler);
        });
    }
}

export default ProtocolsManager;