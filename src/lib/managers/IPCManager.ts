export class IPCManager {
    private endpoints = new Map<string, Map<string, (req: any) => Promise<any>>>();

    constructor() {
        process.on('message', async (arg: IPCObject | null) => {
            if (typeof arg === 'object' && arg?.url?.startsWith('ipc')) {
                const path = arg.url.replace('ipc:/', '');
                const method = arg.method.toUpperCase();
                const methodMap = this.endpoints.get(path);
                const handler = methodMap?.get(method);
                
                if (handler) {
                    try {
                        const result = await handler(arg);
                        process.send?.({ status: 200, body: result, headers: {} });
                    } catch (error: any) {
                        process.send?.({ status: 500, body: error.message || 'Internal error', headers: {} });
                    }
                } else {
                    process.send?.({ status: 404, body: 'Endpoint not found', headers: {} });
                }
            }
        });
    }

    private registerEndpoint(method: string, path: string, handler: (req: any) => Promise<any>) {
        if (!this.endpoints.has(path)) {
            this.endpoints.set(path, new Map());
        }
        this.endpoints.get(path)!.set(method.toUpperCase(), handler);
    }

    get(path: string, handler: (req: any) => Promise<any>) {
        this.registerEndpoint('GET', path, handler);
    }

    post(path: string, handler: (req: any) => Promise<any>) {
        this.registerEndpoint('POST', path, handler);
    }

    put(path: string, handler: (req: any) => Promise<any>) {
        this.registerEndpoint('PUT', path, handler);
    }

    delete(path: string, handler: (req: any) => Promise<any>) {
        this.registerEndpoint('DELETE', path, handler);
    }

    patch(path: string, handler: (req: any) => Promise<any>) {
        this.registerEndpoint('PATCH', path, handler);
    }
}


type IPCObject = {
    method: string,
    url: string,
    headers: Headers,
    body: ReadableStream<Uint8Array<ArrayBufferLike>>
}
