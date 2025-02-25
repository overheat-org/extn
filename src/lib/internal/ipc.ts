export class IPC {
    private endpoints = new Map<string, (req: any) => Promise<any>>();

    constructor() {
        process.on('message', async (arg: IPC_Object | null) => {
            if (typeof arg === 'object' && arg?.url?.startsWith('ipc')) {
                const path = arg.url.replace('ipc:/', '');
                const handler = this.endpoints.get(path);
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

    addEndpoint(path: string, handler: (req: any) => Promise<any>) {
        this.endpoints.set(path, handler);
    }
}


type IPC_Object = {
    method: string,
    url: string,
    headers: Headers,
    body: ReadableStream<Uint8Array<ArrayBufferLike>>
}