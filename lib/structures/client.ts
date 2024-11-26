import { Client } from "discord.js";
import { CommandManager } from "./command.manager";

export class FlameClient extends Client {
    commands = new CommandManager(this) 
    
    constructor(options) {
        super(options);

        this.commands.listen();
    }

    async onReady() {
        const { promise, resolve } = Promise.withResolvers();

        this.once('ready', resolve);

        return await promise;
    }
}