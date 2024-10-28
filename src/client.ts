import Diseact from 'diseact';
import Discord from 'discord.js';
import { getCommandManager } from './utils';

declare const MANAGERS_PATH: string;
declare const COMMANDS_PATH: string;
declare const INTENTS: Discord.BitFieldResolvable<Discord.GatewayIntentsString, number>

const { TOKEN, TEST_GUILD_ID, NODE_ENV } = process.env;
const DEV = NODE_ENV == 'development';

class CommandManager {
    async init() {
        const ctx = require.context(COMMANDS_PATH, true, /\.(t|j)sx?$/);
        
        if(DEV && !TEST_GUILD_ID) {
            throw new Error('TEST_GUILD_ID is not defined on Environment');
        }
        
        getCommandManager(client)!.set(ctx.keys().map(k => (ctx(k) as any).default));
    }

    listen() {
        this.client.on('interactionCreate', interaction => {
            if(interaction.isCommand() || interaction.isAutocomplete()) {
                // TODO: make Diseact autocomplete 
                Diseact.CommandInteractionExecutor(interaction as any);
            }
        })
    }

    constructor(private client: Client) {}
}

class Client extends Discord.Client {
    commands = new CommandManager(this) 
    
    constructor(options: Discord.ClientOptions) {
        super(options);

        this.commands.listen();
        this.onReady().then(() => this.commands.init());
    }

    async onReady() {
        const { promise, resolve } = Promise.withResolvers();

        this.once('ready', resolve);

        return await promise;
    }
}

const client = new Client({ intents: INTENTS });

{
    const ctx = require.context(MANAGERS_PATH, true, /\.(t|j)sx?$/);
    ctx.keys().forEach(k => {
        const isRootFile = /^\.\/[^/]+\.(t|j)sx?$/.test(k);
        const isIndexFile = /^\.\/[^/]+\/index\.(t|j)sx?$/.test(k);
    
        if (!isRootFile && !isIndexFile) return;

        const manager = (ctx(k) as any).default;

        if(typeof manager != 'function') return;

        manager(client);
    });
}

client.login(TOKEN);