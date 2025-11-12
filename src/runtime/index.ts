import { join as j } from "path";
import Manifest from "./manifest";
import CommandManager from "./command";
import EventManager from "./event";
import { ZenClient } from "../lib/structures/Client";
import DependencyManager from "./di/manager";
import Logger from "../utils/logger";
import ProtocolsManager from "./protocols";

declare const VERSION: string

class Runtime {
	constructor(client: ZenClient, private entryUrl: string) {
		Logger.startup(VERSION);

		this.dependencyManager = new DependencyManager(client);
		this.protocolManager = new ProtocolsManager(this.dependencyManager);
		this.commandManager = new CommandManager(client);
		this.eventManager = new EventManager(client, this.dependencyManager, this.commandManager);
	}
	
	private commandManager: CommandManager;
	private dependencyManager: DependencyManager;
	private eventManager: EventManager;
	private protocolManager: ProtocolsManager;

	async start() {
		const manifest = await Manifest.parse(j(this.entryUrl, 'manifest.js'));
		
		this.eventManager.setup();
		this.dependencyManager.load(manifest.dependencies);
		
		await Promise.all([
			this.commandManager.load(j(this.entryUrl, 'commands.js')),
			this.protocolManager.load(manifest.routes),
			this.eventManager.load(manifest.events)
		]);
	}
}

export default Runtime;