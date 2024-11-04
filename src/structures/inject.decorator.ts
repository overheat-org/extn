import { Client } from "discord.js";

function inject(constructor: new (client: Client) => unknown, context: ClassDecoratorContext) {
    if (context.kind != 'class') {
        throw new Error("This Decorator only can be used on Class");
    }

    Object.assign(constructor.prototype, { _injected_: true });

    const fn = (client: Client) => {
        new constructor(client) as object;
    }

    fn.__injector__ = true;

    return fn;
}

global.inject = inject;