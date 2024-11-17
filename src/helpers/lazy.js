const UNINITIALIZED = Symbol();

const queueImports = new Map();
let loaderRunning = false;

function lazy(callback) {
    const key = Symbol();
    
    queueImports.set(key, callback);
    
    if (!loaderRunning) {
        importLoader();
    }

    let value = UNINITIALIZED;
    
    const obj = {};

    Object.defineProperty(obj, 'value', {
        get() {
            if(value == UNINITIALIZED) {
                value = queueImports.get(key)?.();
                value.finally(() => queueImports.delete(key));

                return value;
            }

            return value;
        }
    })
    
    return obj;
}

// TODO: criar uma instrucao comptime, para verificar quantos comandos usam o mesmo modulo, se passar de dois, os comandos vao esperar o mesmo modulo junto.
// TODO: implementar uma lista para definir pacotes que vao ser carregados normalmente (provavelmente ja vao estar carregados, só usar)

async function importLoader() {
    loaderRunning = true;

    while (queueImports.size > 0) {
        const importValue = queueImports.entries().next().value;
        if(!importValue) continue;

        try {
            const [path, importFunc] = importValue;

            importFunc().then(() => queueImports.delete(path));
        } catch (error) {
            throw new Error(`Cannot import this module on lazy mode:\n${error}`);
            // TODO: criar um sistema para descarregar comandos com erro e reportar
        }
    }

    loaderRunning = false;
}