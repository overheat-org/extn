import fs from 'fs/promises';
import { ConfigEvaluator } from "./config.evaluator";
import { pathToFileURL } from 'url';
import { join as j } from "path"
import { Config, ModuleConfig, ConfigResolveOptions, UserConfig } from './config.dto';

/**
 * @internal
 * 
 * Get config file based in cwd path and evaluate
 */
export class ConfigManager {
	private configEvaluator = new ConfigEvaluator();

	regex = /^\.zenrc|zen\.config\.(j|t)s(on)?$/;

	async resolve(cwd: string, options?: ConfigResolveOptions<false>): Promise<Config>;
	async resolve(cwd: string, options?: ConfigResolveOptions<true>): Promise<ModuleConfig>;
	async resolve(cwd: string, options?: ConfigResolveOptions): Promise<Config | ModuleConfig>;
	async resolve(cwd: string, options: ConfigResolveOptions = {}) {
		const url = await this.findFile(cwd);
		if(!url) return;
		
		const data = await fs.readFile(url, 'utf-8');
		const unresolved = await this.parseData(url.href, data);
		return this.configEvaluator.eval(unresolved, options);
	}

	async findFile(cwd: string) {
		const files = await fs.readdir(cwd);
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