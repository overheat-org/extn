declare global {
    /**
     * @kind Decorator
     * @description Marks a method as a Discord event handler.
     * The method name must start with "Once" or "On" followed by the event name (e.g., OnceReady, OnMessageCreate).
     *
     * @example
     * ```ts
     * *@manager*
     * class Init {
     *     *@event*
     *     OnceReady() {
     *         console.log('Bot is ready');
     *     }
     * }
     * ```
     */
    function event(
        target: (...args: any[]) => void,
        context: ClassMethodDecoratorContext<any>
    ): void;

    /**
     * @kind Decorator
     * @description Marks a class as injectable. Its dependencies will be resolved at compile-time based on the constructor parameters.
     *
     * @example
     * ```ts
     * *@injectable*
     * class PaymentService {
     *     constructor(private api: ApiService) {}
     * }
     * ```
     */
    function injectable(
        constructor: new (...args: any[]) => unknown,
        context: ClassDecoratorContext
    ): void;

    /**
     * @kind Decorator
     * @description Marks a class as a singleton entry-point, Its dependencies will be resolved at compile-time based on the constructor parameters.
     *
     * @example
     * ```ts
     * *@manager*
     * class Init {
     *     constructor(private client: Client) {}
     * }
     * ```
     */
    function manager(
        constructor: new (...args: any[]) => unknown,
        context: ClassDecoratorContext
    ): void;

    /**
     * @kind Decorator Group
     * @description Defines a class method as an HTTP route (for use in web servers or IPC with HTTP-like syntax).
     *
     * @example
     * ```ts
     * class Init {
     *     *@http.post('/api/start')*
     *     start({ body }) {
     *         // handle request
     *     }
     * }
     * ```
     */
    const http: HTTPBased;

    /**
     * @kind Decorator Group
     * @description Defines a method as an IPC route using HTTP-like methods (e.g., GET, POST).
     *
     * @example
     * ```ts
     * class Init {
     *     *@api.get('/bot/status')*
     *     status({ respond }) {
     *         respond({ online: true });
     *     }
     * }
     * ```
     */
    const api: HTTPBased;

    interface HTTPBased {
        get:     HTTPDecorator;
        head:    HTTPDecorator;
        post:    HTTPDecorator;
        put:     HTTPDecorator;
        delete:  HTTPDecorator;
        connect: HTTPDecorator;
        options: HTTPDecorator;
        trace:   HTTPDecorator;
        patch:   HTTPDecorator;
    }

    type HTTPDecorator = (
        route: string
    ) => (
        target: (...args: any[]) => void,
        context: ClassMethodDecoratorContext<any>
    ) => void;
}

export {};
