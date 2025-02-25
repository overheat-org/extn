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
export function singleton(constructor: new () => unknown, context: ClassDecoratorContext) {}

global.singleton = singleton;