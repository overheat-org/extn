import { Client } from "discord.js";

export class FlameClient extends Client {
    async onReady() {
        const { promise, resolve } = Promise.withResolvers();

        this.once('ready', resolve);

        return await promise;
    }
}