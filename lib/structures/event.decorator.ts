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
export function event(target: (...args: any[]) => void, context: ClassMethodDecoratorContext<any>) {
    // The logic of this decorator is comptime
}