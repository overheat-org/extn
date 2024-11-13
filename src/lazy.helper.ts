const queueImports = new Map<string, () => Promise<unknown>>();
let loaderRunning = false;

function LazyImport(path: string) {
    queueImports.set(path, () => import(path));
    
    if (!loaderRunning) {
        importLoader();
    }
    
    return {
        get value() {
            queueImports.delete(path);
            return queueImports.get(path)?.();
        }
    }
}

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
        }
    }

    loaderRunning = false;
}