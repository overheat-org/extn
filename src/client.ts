import Diseact from 'diseact';
import Discord from 'discord.js';
import { getCommandManager } from './utils';

declare const MANAGERS_PATH: string;
declare const COMMANDS_PATH: string;
declare const INTENTS: Discord.BitFieldResolvable<Discord.GatewayIntentsString, number>

const { TOKEN, TEST_GUILD_ID, NODE_ENV } = process.env;
const DEV = NODE_ENV == 'development';

const commands = new Array;

{
    const ctx = require.context(COMMANDS_PATH, true, /\.(t|j)sx?$/);
    for(const key of ctx.keys()) commands.push((ctx(key) as any).default);
}

class CommandManager {
    async init() {
        if(DEV && !TEST_GUILD_ID) {
            throw new Error('TEST_GUILD_ID is not defined on Environment');
        }
        
        getCommandManager(client)!.set(commands);
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
    for(const key of ctx.keys()) {
        const isCommandFile = /^\.\/.+\/commands?\.(t|j)sx?$/.test(key);

        if(isCommandFile) {
            const context = ctx(key) as any;
            commands.push(context.default ? context.default : context);

            continue;
        }

        const isRootFile = /^\.\/[^/]+\.(t|j)sx?$/.test(key);
        const isIndexFile = /^\.\/[^/]+\/index\.(t|j)sx?$/.test(key);
    
        if (!isRootFile && !isIndexFile) continue;

        const manager = (ctx(key) as any).default;

        if(typeof manager != 'function' || !manager.__injector__) continue;

        manager(client);
    }
}

client.login(TOKEN);