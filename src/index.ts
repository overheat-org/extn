import * as vite from 'vite';
import { type Config, ConfigManager } from './config';
import Scanner from './scanner';
import Transformer from './transformer';
import Graph from './graph';
import CodeGenerator from './codegen';
import BridgePlugin from './plugin';

class Compiler {
    private configManager: ConfigManager;
	graph = new Graph();
	transformer = new Transformer(this.graph);
	codegen = new CodeGenerator(this.graph);
    scanner!: Scanner;
    config!: Config;

    private async setup() {
        await this.configManager.setup();
        this.config = this.configManager.data;
        (this.config.vite!.plugins ??= []).push(BridgePlugin(this));
		
        this.scanner = new Scanner(this.config, this.transformer);
    }

    async build() {
        await this.setup();
        await this.scanner.scan();
        await vite.build(this.config.vite);
    }

    constructor(configData?: string) {
        this.configManager = new ConfigManager(configData);
    }
}

export default Compiler;
