import _http from 'http';

let server: _http.Server | null = null;
const map = new Map<`${HttpMethod} ${Url}`, Target>();

const { PORT = '3000', HOSTNAME = 'localhost' } = process.env;

function _http_decorator(method: HttpMethod, route: Href) {
    return (target: Target, context: ClassMethodDecoratorContext<any>) => {
        const url: Url = `http://${HOSTNAME}:${PORT}${route}`;

        context.addInitializer(function (this: unknown) {
            const key = `${method} ${url}` as const;
            map.set(key, target.bind(this));
        });
    
        if(!server) {
            server = _http.createServer(async (req, res) => {
                const method = req.method?.toLowerCase() as HttpMethod;
                const url: Url = `http://${req.headers.host}${req.url}`;

                const handler = map.get(`${method} ${url}`);
                if (handler) {
                    const body = await collectRequestBody(req);
                    handler({ body, request: req, response: res });
                    return;
                }
                
                res.statusCode = 404;
                res.end('Not Found');
            });

            server.listen(parseInt(PORT!), HOSTNAME, undefined, undefined);
        }
    }
}

/**
 * @kind Decorator
 * @description Defines a class method as http server route
 * 
 * @example
 * ```javascript
 * class InitManager {
 *      *@http.post('/api/init')*
 *      onInitApi({ request, response, body }) {
 *          
 *      }
 * }
 */
export const http = {
    get:     (route: Href) => _http_decorator('get', route),
    head:    (route: Href) => _http_decorator('head', route),
    post:    (route: Href) => _http_decorator('post', route),
    put:     (route: Href) => _http_decorator('put', route),
    delete:  (route: Href) => _http_decorator('delete', route),
    connect: (route: Href) => _http_decorator('connect', route),
    options: (route: Href) => _http_decorator('options', route),
    trace:   (route: Href) => _http_decorator('trace', route),
    patch:   (route: Href) => _http_decorator('patch', route),
}

global.http = http;

function collectRequestBody(req: _http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

type HttpMethod = 'get' | 'head' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch';
type Target = (...args: any []) => void;
type Url = 
    | `${string}://${string}`
    | `${string}://${string}${Href}`
    | `${string}://${string}:${string}`
    | `${string}://${string}:${string}${Href}`;
type Href = `/${string}`