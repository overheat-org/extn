import { getEnvFile } from "./compiler/env";
import { Config } from "./config";

export default {
    main: config => `
        import { FlameClient } from '@flame-oh/core';

        process.env = {
            ...process.env,
            ...${JSON.stringify(getEnvFile(config.cwd))}
        }

        const client = new FlameClient({
            entryUrl: import.meta.url,
            intents: ${JSON.stringify(config.intents)}
        });

        client.start();
    `
} satisfies { [key: string]: (config: Config) => unknown | unknown }
