import * as vite from 'vite';
import { type Config, ConfigManager } from './config';
import Scanner from './scanner';

class Compiler {
    private configManager: ConfigManager;
    private scanner!: Scanner;
    config!: Config;

    private async setup() {
        await this.configManager.setup();
        this.config = this.configManager.data;
        this.scanner = new Scanner(this.config);
    }

    async build() {
        await this.scanner.scan();
        await this.setup();
        await vite.build(this.config.vite);
    }

    constructor(configData?: string) {
        this.configManager = new ConfigManager(configData);
    }
}

export default Compiler;
