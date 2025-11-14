import fs from "fs/promises";
import { join as j } from "path";
import { ConfigManager } from "../config";
import Graph from "./graph";
import Transformer from "./transformer";
import BridgePlugin from "./plugin";
import { FileTypes } from "../consts";

class Scanner {
	private graph = new Graph();
    private configManager = new ConfigManager();
	private transformer = new Transformer(this.graph, this);
	private transformMap: Record<FileTypes, (path: string, source: string) => Promise<void>>

	async scanRootModule(path: string) {
		const config = await this.configManager.resolve(path);

		(config.vite!.plugins ??= []).unshift(BridgePlugin(this.graph));
		const basePath = j(path, config.entryPath);

		await Promise.all([
			this.scanGlob(config.commandsPath, { cwd: basePath, type: FileTypes.Command }),
			this.scanGlob(config.servicesPath, { cwd: basePath, type: FileTypes.Service }),
		]);

		return config;
	}

	async scanModule(path: string) {
		const config = await this.configManager.resolveModule(path);
		const basePath = j(path, config.entryPath);

		await Promise.all([
			this.scanGlob(config.commandsPath, { cwd: basePath, type: FileTypes.Command }),
			this.scanGlob(config.servicesPath, { cwd: basePath, type: FileTypes.Service }),
		]);
	}

	async scanGlob(pattern: string, opts: { type: FileTypes, cwd: string }) {
		for await (const path of fs.glob(pattern, { cwd: opts.cwd })) {
			await this.scanFile(j(opts.cwd, path), opts.type);
		}
	}
	
	async scanFile(path: string, type: FileTypes) {
		const source = await fs.readFile(path, 'utf-8');

		const transform = this.transformMap[type].bind(this.transformer);

		await transform(path, source);
	}

	constructor() {
		this.transformMap = {
			[FileTypes.Command]: this.transformer.transformCommand,
			[FileTypes.Service]: this.transformer.transformService
		}
	}
}

export default Scanner;