import fs from "fs";
import { BitFieldResolvable, GatewayIntentsString } from "discord.js";
import * as vite from "vite";
import path, { join as j } from "path"
import { RollupOptions } from "rollup";
import globMatch from 'picomatch';

export interface Config {
	entryPath: string
	buildPath: string
	commandsPath: string
	managersPath: string
	cwd: string
	intents: BitFieldResolvable<GatewayIntentsString, number>
	vite: vite.UserConfig
}

interface UserConfig extends Partial<Config> { }

/**
 * @internal
 * 
 * Walk around config object and execute instructions based in
 */

class ConfigEvaluator {
	config!: UserConfig;

	eval(config: UserConfig) {
		this.config = config;

		this.evalPaths(config);
		this.evalVite(config.vite ??= {});
	}

	private evalPaths(config: UserConfig) {
		config.entryPath ??= "src";
		config.buildPath ??= ".flame";
		config.cwd ??= process.cwd();
		config.commandsPath = "commands/**/*.tsx";
		config.managersPath = "managers/**/*.tsx";
	}

	private evalVite(config: vite.UserConfig) {
		config.base = './';
		config.build ??= {};
		config.build.outDir = j(this.config.cwd!, this.config.buildPath!);

		const rollup = config.build.rollupOptions ??= {};

		this.evalRollupInput(rollup);
		this.evalRollupExternal(rollup);
		this.evalRollupOutput(rollup);
	}

	private evalRollupInput(rollup: RollupOptions) {
		rollup.preserveEntrySignatures = "allow-extension";

		let input = rollup.input;
		if (input && !Array.isArray(input) && typeof input === "object") {
			throw new Error("Rollup input as object is not supported");
		}
		if (typeof input === "string") {
			input = [input];
		}
		rollup.input ??= [];

		(rollup.input as any[]).push(
			'virtual:index',
			'virtual:commands',
			'virtual:manifest'
		);
	}

	private evalRollupExternal(rollup: RollupOptions) {
		rollup.external = (id) => {
			const input = (this.config.vite!.build!.rollupOptions!.input as any[])
				.map(i => path.resolve(this.config.cwd!, i));

			const normalizedId = path.resolve(id);

			if (input.includes(normalizedId)) return false;

			return /^((?!\.\/|\.\.\/|virtual:).)*$/.test(id);

		};

		// const prev = rollup.external;
		// const defaultRegex = /node_modules|^node\:|dist/;

		// if (!prev) {
		// 	rollup.external = defaultRegex;
		// } else if (typeof prev === "function") {
		// 	rollup.external = (id, ...args) =>
		// 		prev(id, ...args) || defaultRegex.test(id);
		// } else if (prev instanceof RegExp) {
		// 	rollup.external = (id: string) => prev.test(id) || defaultRegex.test(id);
		// } else {
		// 	const arr = Array.isArray(prev) ? prev : [prev];
		// 	rollup.external = (id: string) =>
		// 		arr.some((e) => (typeof e === "string" ? e === id : e.test?.(id) || false)) ||
		// 		defaultRegex.test(id);
		// }
	}

	private evalRollupOutput(rollup: RollupOptions) {
		const output = rollup.output ??= {};

		if (Array.isArray(output)) {
			throw new Error("Rollup output as array is not supported");
		}

		output.preserveModules = true;
		output.format = "esm";
		output.virtualDirname = output.dir;
		(output.entryFileNames as any) = (chunk: vite.Rollup.PreRenderedChunk) => {
			if (chunk.facadeModuleId?.startsWith('virtual:')) {
				return chunk.facadeModuleId.split(':')[1] + '.js';
			}
			else if (globMatch(this.config.managersPath, chunk.facadeModuleId)) {
				return 'managers/[name].js';
			}

			return '[name].js'
		}

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

		throw new Error("Config extension not recognized");
	}

	constructor(private configData?: string) {
	}
}
