import * as vite from 'vite';
import BridgePlugin from './plugin';
import { Config, ConfigManager } from './config';

class Compiler {
	private configManager: ConfigManager;
	config: Config;

	private async setup() {
		await this.configManager.setup();
		this.config = this.configManager.data;

		((this.config.vite ??= {}).plugins ??= []).push(BridgePlugin.setup());
	}

	async build() {
		await this.setup();
		await vite.build(this.config.vite);
	}

	constructor(configData?: string) {
		this.configManager = new ConfigManager(configData);
	}
}

export default Compiler;