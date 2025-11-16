import { Events } from "discord.js";
import DependencyManager from "./di/manager";
import CommandManager from "./command";
import { ClassLike } from "./di/resolver";
import { Logger } from "@extn/shared";
import type { ExtnClient } from "extn.js";

export interface Event {
    type: any,
    once?: boolean,
    handler: string,
    entity: ClassLike
}

class EventManager {
	constructor(
		private client: ExtnClient, 
		private dependencyManager: DependencyManager, 
		private commandManager: CommandManager
	) {}

    async load(events: Event[]) {
		events.forEach(this.loadEvent.bind(this));
    }

    setup() {
        this.client.on(Events.InteractionCreate, interaction => {
            if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
                this.commandManager.run(interaction);
            }
        });

        this.client.once(Events.ClientReady, () => {
			Logger.ready(this.client.user?.tag ?? "unknown");
			this.commandManager.register();
		});
    }

    private loadEvent(event: Event) {
        const instance = this.dependencyManager.getInstanceFrom(event.entity);
        if(!instance) {
            throw new Error("Use @event in classes marked with injectable or manager.")
        }
        
        const handler = instance[event.handler].bind(instance);

        this.client[event.once ? 'once' : 'on'](event.type, handler);
    }
}

export default EventManager;