import fs from "fs/promises";
import { join as j } from "path";
import Compiler from ".";
import { Config, ModuleConfig } from "../config";

export enum ScanType {
	Command,
	Service
}

class Scanner {
	async scanModule<E extends boolean = false>(path: string, opts: { external?: E } = {}) {
		const config = await this.compiler.configManager.resolve(
			path, 
			{ module: opts.external }
		) as E extends true ? ModuleConfig : Config;
		if(!config) return;

		const basePath = j(path, config.entryPath);

		await Promise.all([
			this.scanGlob(config.commandsPath, { cwd: basePath, type: ScanType.Command }),
			this.scanGlob(config.servicesPath, { cwd: basePath, type: ScanType.Service }),
		]);

		return {
			config
		}
	}

	async scanGlob(pattern: string, opts: { type: ScanType, cwd: string }) {
		for await (const path of fs.glob(pattern, { cwd: opts.cwd })) {
			await this.scanFile(j(opts.cwd, path), opts.type);
		}
	}
	
	private transformMap: Record<ScanType, (path: string, source: string) => Promise<void>>

	async scanFile(path: string, type: ScanType) {
		const source = await fs.readFile(path, 'utf-8');

		const transform = this.transformMap[type].bind(this.compiler.transformer);

		await transform(path, source);
	}

	constructor(private compiler: Compiler) {
		this.transformMap = {
			[ScanType.Command]: this.compiler.transformer.transformCommand,
			[ScanType.Service]: this.compiler.transformer.transformService
		}
	}
}

export default Scanner;