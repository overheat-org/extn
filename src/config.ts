import type { BitFieldResolvable, GatewayIntentsString } from 'discord.js';
import { join as j } from 'path/posix';

class Config {
    #cwd!: string;
    get cwd() {
        return this.#cwd;
    }
    set cwd(value: string) {
        this.#cwd = value.replace(/\\/g, '/');
    }

    #buildPath!: string;
    get buildPath() {
        return this.#buildPath;
    }
    set buildPath(value) {
        this.#buildPath = j(this.cwd.replace(/\\/g, '/'), value);
    };
    
    #entryPath!: string;
    get entryPath() {
        return this.#entryPath;
    }
    set entryPath(value) {
        this.#entryPath = j(this.cwd.replace(/\\/g, '/'), value);
    };

    intents: BitFieldResolvable<GatewayIntentsString, number> = ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']

    constructor(obj: Partial<Config>) {
        for(const key of Object.keys(obj)) {
            // @ts-ignore
            this[key] = obj[key];
        }
    }

    merge(obj: Partial<Config>) {
        for(const key of Object.keys(obj)) {
            // @ts-ignore
            this[key] = obj[key];
        }

        return this;
    }
    
    static getInstance(path: string, cwd = process.cwd()) {
        const defaultConfig = new Config({
            cwd,
            entryPath: 'src',
            buildPath: '.flame', 
        });

        const config = (() => {
            try {
                // This string template is required to webpack
                return require(`${path}`) as Config;
            }
            catch {
                return null;
            }
        })();

        return config ? defaultConfig.merge(config) : defaultConfig;
    }
}

export default Config;