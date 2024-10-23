import { Client, ClientEvents } from "discord.js";

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