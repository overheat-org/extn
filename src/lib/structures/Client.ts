import { Client, ClientOptions } from "discord.js";
import DependencyManager from "../managers/DependencyManager";
import CommandManager from "../managers/CommandManager";
import { dirname } from "path";
import CommunicationManager from "../managers/CommunicationManager";
import EventManager from "../managers/EventManager";

export class FlameClient extends Client {
    private dependencyManager = new DependencyManager(this);
    private commandManager = new CommandManager();
    private communicationManager = new CommunicationManager(this.dependencyManager);
    private eventManager = new EventManager(this, this.dependencyManager, this.commandManager);
    private entryUrl: string;

    constructor(options: ClientOptions & { entryUrl: string }) {
        super(options);

        this.entryUrl = dirname(options.entryUrl);
    }

    private async bootstrap(): Promise<void> {      
        await this.dependencyManager.resolve(this.entryUrl),
        
        await Promise.all([
            this.commandManager.load(this.entryUrl),
            this.communicationManager.load(this.entryUrl),
            this.eventManager.load(this.entryUrl)
        ]);
    }

    public async start(): Promise<string> {
        this.eventManager.setup();
        await this.bootstrap();
        return this.login(process.env.TOKEN!);
    }
}