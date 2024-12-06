import { Storage } from "../utils.js";

export abstract class Manager {
    /**
     * A keyv instance for this class.
     * All instances of this classes will use the same keyv instance.
     * You can use `static override storage: Storage<Type>` to pass a specific type value
     */
    static get storage() {
        const storage = new Storage(this.name);

        Object.defineProperty(this, 'storage', {
            value: storage,
            writable: false,
            configurable: false
        });

        return storage;
    }
}