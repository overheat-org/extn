import { Client } from "discord.js";

declare const inject: any;
declare const event: any;

@inject
class Init {
    @event
    OnceReady() {
        console.log('READY')    
    }

    constructor(private client: Client) {}
}

export default Init;