import * as vite from 'vite';
import { type Config, ConfigManager } from './config';

class Compiler {
    private configManager: ConfigManager;

    config!: Config;

    private async setup() {
        await this.configManager.setup();
        this.config = this.configManager.data;
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
