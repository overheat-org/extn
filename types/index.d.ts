import './env';
import './extensions';
import '@rsbuild/core/types';
import { 
    ApplicationCommand, 
    ApplicationCommandManager, 
    Client, 
    GuildApplicationCommandManager, 
    GuildResolvable 
} from 'discord.js';

declare global {
    /**
     * @kind Decorator
     * @description Mark a Manager to be instantiate on core to get Discord Client
     * 
     * @example
     * ```javascript
     * *@inject*
     * class InitManager {
     *     constructor(client) {
     *          client.once('ready', console.log)
     *     }
     * }
     * ```
     */
    function inject(constructor: new (client: Client) => unknown, context: ClassDecoratorContext): void

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
    function event<This extends { client: Client, _injected_?: true }>(target: (...args: any[]) => void, context: ClassMethodDecoratorContext<any>): void

    type HttpDecorator = (
        route: Href, 
        options?: {}
    ) => (
        target: Target, 
        context: ClassMethodDecoratorContext<any>
    ) => void;
    
    /**
     * @kind Decorator
     * @description Defines a class method as http server route
     * 
     * @example
     * ```javascript
     * class InitManager {
     *      *@http.post('/api/init')*
     *      onInitApi({ request, response, body }) {
     *          
     *      }
     * }
     */
    var http: {
        get: HttpDecorator,
        head: HttpDecorator,
        post: HttpDecorator,
        put: HttpDecorator,
        delete: HttpDecorator,
        connect: HttpDecorator,
        options: HttpDecorator,
        trace: HttpDecorator, 
        patch: HttpDecorator,
    }
}

type Target = (...args: any []) => void;
type Href = `/${string}`

declare class ExtendedApplicationCommandManager extends ApplicationCommandManager {
    upsert(command: any): Promise<ApplicationCommand<{
        guild: GuildResolvable;
    }>>
}

export const getCommandManager: (client: Client) => ExtendedApplicationCommandManager;
