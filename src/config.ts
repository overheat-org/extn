import fs from "fs";
import { BitFieldResolvable, GatewayIntentsString } from "discord.js";
import * as vite from "vite";
import path, { join as j } from "path"
import { RollupOptions } from "rollup";
import globMatch from 'picomatch';
import { pathToFileURL } from "url";

export interface Config {
	entryPath: string
	buildPath: string
	commandsPath: string
	managersPath: string
	cwd: string
	intents: BitFieldResolvable<GatewayIntentsString, number>
	vite: vite.UserConfig
	modules: string[]
}

export interface UserConfig extends Partial<Config> { }

interface ModuleConfig extends Pick<Config, 
	| 'commandsPath' 
	| 'managersPath'
	| 'entryPath'
	| 'intents'
> {}

/**
 * @internal
 * 
 * Walk around config object and execute instructions based in
 */
class ConfigEvaluator {
	config!: UserConfig;

	eval(config: UserConfig, options: ConfigResolveOptions) {
		this.config = config;

		this.evalPaths(config);

		if(!options.module) {
			this.evalVite(config.vite ??= {})

			return this.config as Config;
		}
		else {
			return this.config as ModuleConfig;
		}
	}

	private evalPaths(config: UserConfig) {
		config.entryPath ??= "src";
		config.buildPath ??= ".flame";
		config.cwd ??= process.cwd();
		config.commandsPath ??= "commands/**/*.tsx";
		config.managersPath ??= "managers/**/*.tsx";
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
			'virtual:index'
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
	private configEvaluator = new ConfigEvaluator();

	regex = /^\.flamerc|flame\.config\.(j|t)s(on)?$/;

	async resolve(cwd: string, options?: ConfigResolveOptions<false>): Promise<Config>;
	async resolve(cwd: string, options?: ConfigResolveOptions<true>): Promise<ModuleConfig>;
	async resolve(cwd: string, options?: ConfigResolveOptions): Promise<Config | ModuleConfig>;
	async resolve(cwd: string, options: ConfigResolveOptions = {}) {
		const url = await this.findFile(cwd);
		if(!url) return;
		
		const data = await fs.promises.readFile(url, 'utf-8');
		const unresolved = await this.parseData(url.href, data);
		return this.configEvaluator.eval(unresolved, options);
	}

	async findFile(cwd: string) {
		const files = await fs.promises.readdir(cwd);
		const fileName = files.find(f => this.regex.test(f));
		if (!fileName) return;

		return pathToFileURL(j(cwd, fileName));
	}

	parseData(path: string, data: string) {
		if (/\.(j|t)s$/.test(path)) {
			return (async () => (
				{...(await import(path)).default}
			))() as Promise<UserConfig>;
		}
		else if (/\.json|\.\w+rc$/.test(path)) {
			return JSON.parse(data) as UserConfig;
		}

		throw new Error("Config extension not recognized");
	}
}

interface ConfigResolveOptions<Module extends boolean = boolean> { 
	module?: Module
}