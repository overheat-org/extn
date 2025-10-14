import { Config, ConfigManager } from "../config";
import fs from "fs/promises";
import Transformer from "./transformer";
import { dirname, join as j } from "path";
import Analyzer from "./analyzer";

enum ScanType {
	Command,
	Service
}

/** @internal */
class Scanner {
	async scan() {
		await Promise.all([
			this.scanGlob(ScanType.Command),
			this.scanGlob(ScanType.Service),
		])
	}

	private globPatternPropertyMap = {
		[ScanType.Command]: 'commandsPath',
		[ScanType.Service]: 'servicesPath'
	}

	async scanGlob(type: ScanType) {
		const { cwd, entryPath } = this.config;
		const basePath = j(cwd, entryPath);

		const pattern = this.config[this.globPatternPropertyMap[type]];

		for await (const path of fs.glob(pattern, { cwd: basePath })) {
			await this.scanFile(j(entryPath, path), type);
		}
	}

	async scanFile(path: string, type: ScanType) {
		const source = await fs.readFile(path, 'utf-8');

		const transform = {
			[ScanType.Command]: this.transformer.transformCommand,
			[ScanType.Service]: this.transformer.transformService
		}[type];

		await transform(path, source);
	}


	private async scanModules() {
		const configManager = new ConfigManager();
		const { modules } = this.config;

		if (!modules) return;

		for (const module of modules) {
			const path = import.meta.resolve(module);
			const dirpath = dirname(path);

			const config = await configManager.resolve(dirpath, { module: true });
			const { commandsPath, servicesPath: managersPath, entryPath } = config;

			const { input } = this.config.vite!.build!.rollupOptions!;

			for await (const path of fs.glob(commandsPath, { cwd: entryPath })) {
				const code = await fs.readFile(j(entryPath, path), 'utf-8');
				await this.transformer.transformModule(path, code);
			}

			if (Array.isArray(input)) {
				for await (const path of fs.glob(managersPath, { cwd: entryPath })) {
					input.push(j(entryPath, path));
				}
			}
		}
	}

	constructor(private config: Config, private transformer: Transformer, private analyzer: Analyzer) { }
}

export default Scanner;
