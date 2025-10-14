import { Config, ConfigManager } from "../config";
import fs from "fs/promises";
import Transformer from "./transformer";
import { dirname, join as j } from "path";

/** @internal */
class Scanner {
	async scan() {
		await Promise.all([
			// this.scanCommandsFiles(),
			this.scanManagersFiles(),
			this.scanModules()
		]);
	}

	private async scanCommandsFiles() {
		const { entryPath, commandsPath } = this.config;

		for await (const path of fs.glob(commandsPath, { cwd: entryPath })) {
			const code = await fs.readFile(j(entryPath, path), 'utf-8');
			await this.transformer.transformCommand(path, code);
		}
	}

	private async scanManagersFiles() {
		const { cwd, entryPath, managersPath } = this.config;
		const { input } = this.config.vite!.build!.rollupOptions!;

		if (!Array.isArray(input)) return;
		
		const basePath = j(cwd, entryPath);

		console.log(basePath)

		for await (const path of fs.glob(managersPath, { cwd: basePath })) {
			input.push(j(entryPath, path));
		}
	}

	private async scanModules() {
		const configManager = new ConfigManager();
		const { modules } = this.config;

		if(!modules) return;

		for (const module of modules) {
			const path = import.meta.resolve(module);
			const dirpath = dirname(path);

			const config = await configManager.resolve(dirpath, { module: true });
			const { commandsPath, managersPath, entryPath } = config;

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

	constructor(private config: Config, private transformer: Transformer) { }
}

export default Scanner;
