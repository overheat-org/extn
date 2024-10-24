import { Client } from "discord.js";

declare const client: Client;

function inject(constructor: new (client: Client) => unknown, context: ClassDecoratorContext) {
    if (context.kind != 'class') {
        throw new Error("This Decorator only can be used on Class");
    }

    Object.assign(constructor.prototype, { _injected_: true });

    new constructor(client) as object;
}

global.inject = inject;