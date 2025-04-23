import type { BitFieldResolvable, GatewayIntentsString } from 'discord.js';
import { join as j } from 'path/posix';
import { Module } from './compiler/module';

class Config {
    static DEFAULT = {
        entryPath: './src',
        buildPath: './.flame'
    } as Config 

    cwd!: string;

    #buildPath!: string;
    get buildPath() {
        return this.#buildPath;
    }
    set buildPath(value) {
        this.#buildPath = toAbsolutePath(value, this.cwd);
    }
    
    #entryPath!: string;
    get entryPath() {
        return this.#entryPath;
    }
    set entryPath(value) {
        this.#entryPath = toAbsolutePath(value, this.cwd);
    }

	extensions = [".js", ".jsx", ".ts", ".tsx"]

    intents: BitFieldResolvable<GatewayIntentsString, number> = ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']

    constructor(obj: Partial<Config>) {
        this.cwd = obj.cwd ?? Config.DEFAULT.cwd;
        this.entryPath = obj.entryPath ?? Config.DEFAULT.entryPath;
        this.buildPath = obj.buildPath ?? Config.DEFAULT.buildPath;
    }
}

function toAbsolutePath(path: string, parentPath: string) {
    return Module.normalizePath(
        path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path)
            ? path
            : j(parentPath, path)
    );
}

export default Config;