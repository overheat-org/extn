import Diseact from 'diseact';
import Discord from 'discord.js';
import _commands from './commands';

const { TOKEN } = process.env;

void async function () {
    const module = await _commands();
    await Promise.all(Object.values(module));
}();

class CommandManager {
    listen() {
        this.client.on('interactionCreate', interaction => {
            if(interaction.isCommand() || interaction.isAutocomplete()) {
                // TODO: make Diseact autocomplete 
                Diseact.CommandInteractionExecutor(interaction);
            }
        })
    }

    constructor(client) {}
}

class Client extends Discord.Client {
    commands = new CommandManager(this) 
    
    constructor(options) {
        super(options);

        this.commands.listen();
    }

    async onReady() {
        const { promise, resolve } = Promise.withResolvers();

        this.once('ready', resolve);

        return await promise;
    }
}

const client = new Client({ intents: INTENTS });

MANAGERS

client.login(TOKEN);