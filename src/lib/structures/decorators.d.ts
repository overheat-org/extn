import { Client } from "discord.js";

declare global {
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
    function event(target: (...args: any[]) => void, context: ClassMethodDecoratorContext<any>): void

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
    function inject(constructor: new (client: Client ) => unknown, context: ClassDecoratorContext): void

    /**
     * @kind Decorator
     * @description Force class to have a unique instance for each data group
     * 
     * @example
     * ```javascript
     * *@singleton*
     * class Product {
     *      // If this product id has already fetched, will returns this instance
     *      // Else, will be created a new instance
     *      static find(id) {}
     * }
     * ```
     */
    function singleton(constructor: new () => unknown, context: ClassDecoratorContext): void

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
    const http: {
        get:     HTTP_Decorator,
        head:    HTTP_Decorator,
        post:    HTTP_Decorator,
        put:     HTTP_Decorator,
        delete:  HTTP_Decorator,
        connect: HTTP_Decorator,
        options: HTTP_Decorator,
        trace:   HTTP_Decorator,
        patch:   HTTP_Decorator,
    }
    
    type HTTP_Decorator = (route: string) => (target: (...args: any []) => void, context: ClassMethodDecoratorContext<any>) =>void
}

export {};