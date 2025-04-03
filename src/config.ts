import type { BitFieldResolvable, GatewayIntentsString } from 'discord.js';
import { join as j } from 'path/posix';
import { Module } from './compiler/module';

class Config {
    static DEFAULT = {
        entryPath: 'src',
        buildPath: '.flame'
    } as Config 

    #cwd = process.cwd();
    get cwd() {
        return this.#cwd;
    }
    set cwd(value: string) {
        this.#cwd = Module.normalizePath(value);
    }

    #buildPath!: string;
    get buildPath() {
        return this.#buildPath;
    }
    set buildPath(value) {
        this.#buildPath = j(Module.normalizePath(this.cwd), value);
    };
    
    #entryPath!: string;
    get entryPath() {
        return this.#entryPath;
    }
    set entryPath(value) {
        this.#entryPath = j(Module.normalizePath(this.cwd), value);
    };

    intents: BitFieldResolvable<GatewayIntentsString, number> = ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']

    constructor(obj: Partial<Config>) {
        Object.assign(this, Config.DEFAULT, obj);
    }
}

export default Config;