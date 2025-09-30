import { Client, ClientOptions } from "discord.js";
import DependencyManager from "../managers/DependencyManager";
import CommandManager from "../managers/CommandManager";
import { dirname } from "path";
import CommunicationManager from "../managers/CommunicationManager";
import EventManager from "../managers/EventManager";
import ModuleManager from "../managers/ModuleManager";
import ManifestManager from "../managers/ManifestManager";

export class FlameClient extends Client {
    private commandManager: CommandManager;
    private dependencyManager = new DependencyManager(this);
    private communicationManager = new CommunicationManager(this.dependencyManager);
    private eventManager: EventManager;
	private moduleManager = new ModuleManager(this.dependencyManager);
	private pending: Promise<void>;

    constructor(options: ClientOptions & { entryUrl: string }) {
        super(options);

        const entryUrl = dirname(options.entryUrl);

		this.commandManager = new CommandManager(entryUrl);
		this.eventManager = new EventManager(this, this.dependencyManager, this.commandManager);
		this.pending = ManifestManager.loadFile(entryUrl);
    }

    private async bootstrap(): Promise<void> {
		await this.pending;
		await this.moduleManager.load();
        await this.dependencyManager.load();
        
        await Promise.all([
            this.commandManager.load(),
            this.communicationManager.load(),
            this.eventManager.load()
        ]);
    }

    public async start(): Promise<string> {
        this.eventManager.setup();
        await this.bootstrap();
        return this.login(process.env.TOKEN!);
    }
}