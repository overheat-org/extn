import { Client } from "discord.js";

@inject
class Init {
    @event
    OnceReady() {
        console.log('READY')    
    }

    constructor(private client: Client) {
        const a = (
            <embed>M
        )
    }
}

export default Init;