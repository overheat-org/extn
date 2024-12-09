class Storage {
    constructor(name) {
        console.log('instantiate')
    }
}

class Manager {
    static get storage() {
        const storage = new Storage(this.name);
        Object.defineProperty(this, 'storage', {
            value: storage,
            writable: false,
            configurable: false
        });
        return storage;
    }

    constructor() {
        this.storage = (this.constructor).storage;
    }
}

class UserManager extends Manager {
    test() {
        console.log('Storage name:', this.storage.name);
    }
}

class ProductManager extends Manager {
    test() {
        console.log('Storage name:', this.storage.name);
    }
}

// Testes
const userManager1 = new UserManager();
const userManager2 = new UserManager();
const productManager1 = new ProductManager();

// userManager1.test(); 
// userManager2.test();
// productManager1.test();