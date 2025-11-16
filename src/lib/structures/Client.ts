import { Client, ClientOptions } from "discord.js";
import { dirname } from "path";
import Runtime from '@runtime';

export class ExtnClient extends Client {
	private runtime: Runtime;

    constructor(options: ClientOptions & { entryUrl: string }) {
        super(options);

        const entryUrl = dirname(options.entryUrl);
		this.runtime = new Runtime(this, entryUrl);
    }

    public async start(): Promise<string> {
		await this.runtime.start();
        return this.login(process.env.TOKEN!);
    }
}