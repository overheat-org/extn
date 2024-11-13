import { Client, ClientEvents } from "discord.js";

/**
 * @kind Decorator
 * @description Use function to handle a function. The first work determines if event will be once or on, respectively Once and Or. The rest of name, is about the type of event 
 * 
 * @example
 * ```javascript
 * *@inject*
 * class InitManager {
 *     *@event*
 *     OnceReady() {
 *          console.log('Ready')
 *     }
 * }
 * ```
 */
export function event<This extends { client: Client, _injected_?: true }>(target: (...args: any[]) => void, context: ClassMethodDecoratorContext<any>) {
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