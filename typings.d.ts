import '@rsbuild/core/types';
import { Client } from 'discord.js';

declare module "*.zig" {}

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

    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production'
            TOKEN: string
            TEST_GUILD_ID?: string
            TEST_CHANNEL_ID?: string
        }
    }

    var client: any
}