import { http as _http } from '../lib/structures/http.decorator';
import { event as _event } from '../lib/structures/event.decorator';
import { inject as _inject } from '../lib/structures/inject.decorator';

declare global {
    var inject: typeof _inject
    var http: typeof _http
    var event: typeof _event
}

declare module '*.zig' {}