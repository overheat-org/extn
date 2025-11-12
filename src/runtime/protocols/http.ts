import http, { IncomingMessage, ServerResponse } from 'http';

type Handler = (req: IncomingMessage, res: ServerResponse) => any;

export class HTTPManager {
    private routes: Record<string, Map<string, Handler>> = {};
    private serverStarted = false;

    private startServer() {
        if (this.serverStarted) return;

        const server = http.createServer((req, res) => {
            if (!req.url || !req.method) {
                res.writeHead(400);
                return res.end('Bad request');
            }

            const handler = this.routes[req.method]?.get(req.url);
            if (!handler) {
                res.writeHead(404);
                return res.end('Not found');
            }

            try {
                handler(req, res);
            } catch (err) {
                res.writeHead(500);
                res.end('Internal server error');
            }
        });

        server.listen(3000);
        this.serverStarted = true;
    }

    private register(method: string, path: string, handler: Handler) {
        if (!this.routes[method]) {
            this.routes[method] = new Map();
        }

        this.routes[method].set(path, handler);
        this.startServer();
    }

    get(path: string, handler: Handler) {
        this.register('GET', path, handler);
    }

    post(path: string, handler: Handler) {
        this.register('POST', path, handler);
    }

    put(path: string, handler: Handler) {
        this.register('PUT', path, handler);
    }

    delete(path: string, handler: Handler) {
        this.register('DELETE', path, handler);
    }
}
