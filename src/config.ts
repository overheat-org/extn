import { TransformOptions } from '@babel/core';
import type { BitFieldResolvable, GatewayIntentsString } from 'discord.js';
import { join as j } from 'path/posix';

const DEFAULT_BABEL = (config: Config): TransformOptions => ({
    sourceType: 'module',
    presets: [
        "@babel/preset-typescript",
        ["@babel/preset-env", {
            modules: false,
            targets: {
                esmodules: true
            }
        }],
        ['@babel/preset-react', {
            pragma: "Diseact.createElement",
            pragmaFrag: "Diseact.Fragment",
            runtime: "classic"
        }],
    ],
    plugins: [
        "@babel/plugin-transform-class-properties",
        ["@babel/plugin-transform-runtime", {
            useESModules: true,
            helpers: false
        }],
        ["transform-define", {
            INTENTS: config.intents,
        }]
    ]
})

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

    #babel: TransformOptions;

    get babel() {
        return this.#babel;
    }

    set babel(value) {
        this.#babel = { ...DEFAULT_BABEL(this), ...value }
    }
    
    intents: BitFieldResolvable<GatewayIntentsString, number> = ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']

    constructor(obj: Partial<Config>) {
        this.#babel = DEFAULT_BABEL(this);
        
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