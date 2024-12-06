import { Client } from "discord.js";

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
export function inject(constructor: new (client: Client) => unknown, context: ClassDecoratorContext) {
    // The logic of this decorator is comptime
}