import { Config } from "./config";

export default {
    main: ctx => `
        import { FlameClient } from '@flame-oh/core';

        process.env = {
            ...process.env,
            ...${JSON.stringify(ctx.env)}
        }

        const client = new FlameClient({
            entryUrl: import.meta.url,
            intents: ${JSON.stringify(ctx.config.intents)}
        });

        client.start();
    `
} satisfies VirtualModules;

type VirtualModuleContext = {
	config: Config
	env: any
}

type VirtualModules = { 
	[key: string]: (context: VirtualModuleContext) => unknown | unknown
}