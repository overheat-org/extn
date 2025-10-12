import * as vite from "vite";
import { Config, ConfigResolveOptions, ModuleConfig, UserConfig } from "./config.dto";
import { join as j } from "path";
import { RollupOptions } from 'rollup';
import path from 'path';
import globMatch from 'picomatch';

/**
 * @internal
 * 
 * Walk around config object and execute instructions based in
 */
export class ConfigEvaluator {
	config!: Config;

	eval(config: UserConfig, options: ConfigResolveOptions) {
		this.config = config as Config;

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
		const managersMatch = globMatch(this.config.managersPath);
		const output = rollup.output ??= {};

		if (Array.isArray(output)) {
			throw new Error("Rollup output as array is not supported");
		}

		output.preserveModules = true;
		output.format = "esm";
		output.virtualDirname = output.dir;
		(output.entryFileNames as any) = (chunk: vite.Rollup.PreRenderedChunk) => {
			const moduleId = chunk.facadeModuleId ?? '';
			if (moduleId.startsWith('virtual:')) {
				return moduleId.split(':')[1] + '.js';
			}
			else if (managersMatch(moduleId)) {
				return 'managers/[name].js';
			}

			return '[name].js'
		}

		rollup.output = output;
	}
}