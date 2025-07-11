import { InlineConfig, UserConfig } from "vite";
import { BuiltinFunctionHooks } from "./hooks/declarations/function";
import * as fs from 'fs';
import { join as j } from 'path';

export type Builtin = BuiltinFunctionHooks;

export interface Environment {
	builtins?: Builtin[];
} 

export interface Config {
	env?: Environment;
	vite?: UserConfig;
}

/**
 * @internal
 * 
 * Walk around config object and execute instructions based in
 */
class ConfigEvaluator {
	eval(config: Config) {
		this.evalEnv(config.env);
	}

	// TODO: push default config
	evalEnv(env?: Environment) {
		env?.builtins?.forEach(this.evalBuiltin.bind(this));
	}

	evalBuiltin(builtin?: Builtin) {
		builtin
	}
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
	private configRegex = /^\.mburc|mbu\.config\.(j|t)s(on)?$/;

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
		if(!fileName) return;

		return j(this.cwd, fileName);
	}

	private async parseConfigData(data: string, path: string) {
		if(/\.(j|t)s$/.test(path)) {
			return await import(path);
		}
		else if(/\.json|\.*rc$/.test(path)) {
			return JSON.parse(data);
		}
		else throw new Error("Config ext not recognized");
	}

	constructor(private configData?: string) {}
}