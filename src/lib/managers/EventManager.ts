import { Client, Events } from "discord.js";
import DependencyManager from "./DependencyManager";
import CommandManager from "./CommandManager";
import { ClassLike } from "../utils/DependencyInjectorResolver";

interface Event {
    type: any,
    once?: boolean,
    handler: string,
    entity: ClassLike
}

class EventManager {
    async load(entryPath: string) {
        try {
            const { default: events }: { default: Event[] } = await import(`${entryPath}/events.js`);

            events.forEach(this.loadEvent.bind(this));
        } catch (err) {
            if(err instanceof Error) {
                throw new Error(`Failed to load events:${err.stack}`);
            }
            else {
                throw err;
            }
        }
    }

    setup() {
        this.client.on(Events.InteractionCreate, interaction => {
            if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
                this.commandManager.run(interaction);
            }
        });

        this.client.once(Events.ClientReady, () => this.commandManager.register(this.client));
    }

    private loadEvent(event: Event) {
        const instance = this.dependencyManager.getInstanceFrom(event.entity);
        if(!instance) {
            throw new Error("Use @event in classes marked with injectable or manager.")
        }
        
        const handler = instance[event.handler].bind(instance);

        this.client[event.once ? 'once' : 'on'](event.type, handler);
    }

    constructor(private client: Client, private dependencyManager: DependencyManager, private commandManager: CommandManager) {}
}

export default EventManager;