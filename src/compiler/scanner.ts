import fs from "fs/promises";
import { join as j } from "path";
import { ConfigManager } from "../config";
import Graph from "./graph";
import Transformer from "./transformer";
import BridgePlugin from "./plugin";

export enum ScanType {
	Command,
	Service
}

class Scanner {
	private graph = new Graph();
    private configManager = new ConfigManager();
	private transformer = new Transformer(this.graph, this);
	private transformMap: Record<ScanType, (path: string, source: string) => Promise<void>>

	async scanRootModule(path: string) {
		const config = await this.configManager.resolve(path);

		(config.vite!.plugins ??= []).unshift(BridgePlugin(this.graph));
		const basePath = j(path, config.entryPath);

		await Promise.all([
			this.scanGlob(config.commandsPath, { cwd: basePath, type: ScanType.Command }),
			this.scanGlob(config.servicesPath, { cwd: basePath, type: ScanType.Service }),
		]);

		return config;
	}

	async scanModule(path: string) {
		const config = await this.configManager.resolveModule(path);
		const basePath = j(path, config.entryPath);

		await Promise.all([
			this.scanGlob(config.commandsPath, { cwd: basePath, type: ScanType.Command }),
			this.scanGlob(config.servicesPath, { cwd: basePath, type: ScanType.Service }),
		]);
	}

	async scanGlob(pattern: string, opts: { type: ScanType, cwd: string }) {
		for await (const path of fs.glob(pattern, { cwd: opts.cwd })) {
			await this.scanFile(j(opts.cwd, path), opts.type);
		}
	}
	
	async scanFile(path: string, type: ScanType) {
		const source = await fs.readFile(path, 'utf-8');

		const transform = this.transformMap[type].bind(this.transformer);

		await transform(path, source);
	}

	constructor() {
		this.transformMap = {
			[ScanType.Command]: this.transformer.transformCommand,
			[ScanType.Service]: this.transformer.transformService
		}
	}
}

export default Scanner;