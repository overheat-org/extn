import { ApplicationCommandManager, Client, ClientEvents } from "discord.js";

function inject(constructor: new (client: Client) => unknown, context: ClassDecoratorContext) {
    if (context.kind != 'class') {
        throw new Error("This Decorator only can be used on Class");
    }

    Object.assign(constructor.prototype, { _injected_: true });

    new constructor(client) as object;
}

global.inject = inject;

function event<This extends { client: Client, _injected_?: true }>(target: (...args: any[]) => void, context: ClassMethodDecoratorContext<any>) {
    if (context.kind != 'method') {
        throw new Error('This Decorator only can be used on Methods')
    }

    let once = false;
    let name = context.name.toString();

    if (name.startsWith('Once')) {
        once = true;
        name = name.replace('Once', '');
        name = name.charAt(0).toLowerCase() + name.slice(1);
    }
    else if (name.startsWith('On')) {
        name = name.replace('On', '');
        name = name.charAt(0).toLowerCase() + name.slice(1);
    }
    else {
        throw new Error(`Invalid name: The method name should starts with "On" or "Once" and continue with a event name`)
    }

    context.addInitializer(function (this: This) {
        if (!this._injected_) {
            throw new Error('The class should be injectable to use this Decorator');
        }

        this.client[once ? 'once' : 'on'](name as keyof ClientEvents, target.bind(this));
    })
}

global.event = event;

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