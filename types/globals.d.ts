import { http as _http } from './structures/http.decorator';
import { event as _event } from './structures/event.decorator';
import { inject as _inject } from './structures/inject.decorator';

declare global {
    var inject: typeof _inject
    var http: typeof _http
    var event: typeof _event
}

declare module '*.zig' {}