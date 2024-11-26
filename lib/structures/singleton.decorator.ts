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
 *      find(id) {}
 * }
 * ```
 */
export function singleton(constructor: new () => unknown, context: ClassDecoratorContext) {
    if (context.kind != 'class') {
        throw new Error("This Decorator only can be used on Class");
    }
    
    if ('find' in constructor) {
        throw new Error("Singleton mode needs a static 'find' method");
    }
}

global.singleton = singleton;