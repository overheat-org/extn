import DependencyManager from "./DependencyManager";
import { IPCManager } from "./IPCManager";
import { HTTPManager } from "./HTTPManager";
import { ClassLike } from "../utils/DependencyInjectorResolver";
import ManifestManager from "./ManifestManager";
import { ManifestType } from "../../consts";

export interface Endpoint {
    endpoint: string,
    method: string,
    handler: string,
    entity: ClassLike,
    ipc?: boolean
}

class CommunicationManager extends ManifestManager {
    ipcManager = new IPCManager();
    httpManager = new HTTPManager();

    async load() {
		const routes = this.manifest[ManifestType.Routes];
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

    constructor(private dependencyManager: DependencyManager) {
		super();
	}
}

export default CommunicationManager;