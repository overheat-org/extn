import { Storage } from "./Storage";

export abstract class Stored<T = any> {
    /**
     * A keyv instance for this class.
     * All instances of this classes will use the same keyv instance.
     * You can use `class MyManager extends Manager<Type>` to pass a specific type value
     */
    protected get storage() {
        const storage = (this.constructor as typeof Stored).storage as Storage<T>;

        Object.defineProperty(this, 'storage', {
            value: storage,
            writable: false,
            configurable: false
        });

        return storage;
    }
    
    /**
     * A keyv instance for this class.
     * All instances of this classes will use the same keyv instance.
     * You can use `static override storage: Storage<Type>` to pass a specific type value
     */
    protected static get storage() {
        const storage = new Storage(this.name);

        Object.defineProperty(this, 'storage', {
            value: storage,
            writable: false,
            configurable: false
        });

        return storage;
    }
}