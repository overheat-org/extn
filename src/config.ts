import fs from "fs";
import { BitFieldResolvable, GatewayIntentsString } from "discord.js";
import { UserConfig } from "vite";
import { join as j } from "path"

export interface Config {
    entryPath?: string
    buildPath?: string
    cwd?: string
    intents?: BitFieldResolvable<GatewayIntentsString, number>
    vite?: UserConfig
}

/**
 * @internal
 * 
 * Walk around config object and execute instructions based in
 */
class ConfigEvaluator {
    config!: Config;

    eval(config: Config) {
        this.config = config;

        this.evalPaths(
            config.entryPath,
            config.buildPath,
            config.cwd
        )

        this.evalVite(config.vite ??= {});
    }

    evalPaths(entry, build, cwd) {
        
    }

    evalVite(config: UserConfig) {
        const input = ((config.build ??= {}).rollupOptions ??= {}).input ??= [];

        (input as Array<any>).push("virtual:main");
    }

    evalRollupOptions() {}
}

/**
 * @internal
 * 
 * Get config file based in cwd path and evaluate
 */
export class ConfigManager {
    data!: Config;
    private cwd = process.cwd();
    private configEvaluator = new ConfigEvaluator();
    private configRegex = /^\.flamerc|flame\.config\.(j|t)s(on)?$/;

   async setup() {
        const configPath = await this.getConfigPath();
        let configData = this.configData
            ?? configPath
            ? await fs.promises.readFile(configPath, 'utf-8')
            : undefined;

        const config = configData ? await this.parseConfigData(configData, configPath) : {};

        this.data = config;
        this.configEvaluator.eval(config);
    }

    private async getConfigPath() {
        const files = await fs.promises.readdir(this.cwd);
        const fileName = files.find(f => this.configRegex.test(f));
        if (!fileName) return;

        return j(this.cwd, fileName);
    }

    private async parseConfigData(data: string, path: string) {
        if (/\.(j|t)s$/.test(path)) {
            return await import(path);
        }
        else if (/\.json|\.\w+rc$/.test(path)) {
            return JSON.parse(data);
        }
        else throw new Error("Config extension not recognized");
    }

    constructor(private configData?: string) {
    }
}
