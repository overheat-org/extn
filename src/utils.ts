import { ApplicationCommandManager, Client } from "discord.js";

const { TEST_GUILD_ID, NODE_ENV } = process.env;

export const getCommandManager = (client: Client) => {
    const commands = NODE_ENV == 'development'
        ? client.guilds.cache.get(TEST_GUILD_ID!)?.commands
        : client.application?.commands;

    if (!commands) {
        throw new Error('Commands manager could not be initialized');
    }

    return Object.assign(Object.create(commands), {
        upsert(this: ApplicationCommandManager, command: any) {
            if (!this.cache.has(command.name)) {
                return commands.create(command);
            } else {
                const existingCommand = commands.cache.find(c => c.name === command.name);
                return commands.edit(existingCommand!.id, command);
            }
        }
    });
};
