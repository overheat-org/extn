import fs from "fs";
import { BitFieldResolvable, GatewayIntentsString } from "discord.js";
import { UserConfig } from "vite";
import { join as j } from "path"
import { RollupOptions } from "rollup";

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

		this.evalPaths(config);
		this.evalVite(config.vite ??= {});
	}

	private evalPaths(config: Config) {
		config.entryPath ??= "src";
		config.buildPath ??= ".flame";
		config.cwd ??= process.cwd();
	}

	private evalVite(config: UserConfig) {
		const build = (config.build ??= {});
		const rollup = (build.rollupOptions ??= {});

		build.outDir = j(this.config.cwd!, this.config.buildPath!);
		build.assetsDir = "";

		config.build = build;

		this.evalRollupInput(rollup);
		this.evalRollupExternal(rollup);
		this.evalRollupOutput(rollup);
	}

	private evalRollupInput(rollup: RollupOptions) {
		rollup.preserveEntrySignatures = "strict";
		
		let input = rollup.input;
		if (input && !Array.isArray(input) && typeof input === "object") {
			throw new Error("Rollup input as object is not supported");
		}
		if (typeof input === "string") {
			input = [input];
		}
		if (!input) input = [];
		input.push(`./${this.config.entryPath!}/index`);
		rollup.input = input;
	}

	private evalRollupExternal(rollup: RollupOptions) {
		const prev = rollup.external;
		const defaultRegex = /node_modules|^node\:|dist/;

		if (!prev) {
			rollup.external = defaultRegex;
		} else if (typeof prev === "function") {
			rollup.external = (id, ...args) =>
				prev(id, ...args) || defaultRegex.test(id);
		} else if (prev instanceof RegExp) {
			rollup.external = (id: string) => prev.test(id) || defaultRegex.test(id);
		} else {
			const arr = Array.isArray(prev) ? prev : [prev];
			rollup.external = (id: string) =>
				arr.some((e) => (typeof e === "string" ? e === id : e.test?.(id) || false)) ||
				defaultRegex.test(id);
		}
	}

	private evalRollupOutput(rollup: RollupOptions) {
		const output = rollup.output ??= {};

		if(Array.isArray(output)) {
			throw new Error("Rollup output as array is not supported");
		}

		output.preserveModules = true;
		output.inlineDynamicImports = false;
		output.format = "esm";
		output.dir = j(this.config.cwd!, this.config.buildPath!);
		output.entryFileNames = "[name].js";
		output.assetFileNames = "[name].[ext]";

		rollup.output = output;
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
