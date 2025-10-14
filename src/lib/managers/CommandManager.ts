// import { InteractionExecutor } from "diseact";
import { AutocompleteInteraction, ChatInputCommandInteraction, Client, Guild } from "discord.js";
import { CommandContainer } from "../utils/CommandContainer";

class CommandManager {
    // private executor = new InteractionExecutor();
    private container?: CommandContainer;

    async load() {
        const { default: container }: { default: CommandContainer } = await import(`${this.entryPath}/commands.js`);

        // this.executor.commandMap = container.map;
        this.container = container;
    }

    async register(client: Client) {
        if(!this.container) {
            throw new Error('CommandManager cannot register without load before');
        }

        const guild: Guild | undefined = process.env.GUILD_ID
            ? client.guilds.cache.get(process.env.GUILD_ID)
            : undefined;

        if (guild) {
            await guild.commands.set(this.container.list);
        } else {
            await client.application!.commands.set(this.container.list);
        }
    }

    async run(interaction: ChatInputCommandInteraction | AutocompleteInteraction) {
        // this.executor.run(interaction);
    }

	constructor(private entryPath: string) {}
}

export default CommandManager;