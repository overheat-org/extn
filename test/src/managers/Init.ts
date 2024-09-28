import { Client } from "discord.js";

@inject
class Init {
    @event
    OnceReady() {
        console.log('READY')    
    }

    constructor(private client: Client) {}
}

export default Init;