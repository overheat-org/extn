import * as vite from 'vite';
import { type Config, ConfigManager } from './config';
import Scanner from './scanner';
import Transformer from './transformer';
import Graph from './graph';

class Compiler {
    private configManager: ConfigManager;
    private scanner!: Scanner;
	private graph!: Graph;
	private transformer!: Transformer;
    config!: Config;

    private async setup() {
        await this.configManager.setup();
        this.config = this.configManager.data;
		
		this.graph = new Graph();
		this.transformer = new Transformer(this.graph);
        this.scanner = new Scanner(this.config, this.transformer);
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
