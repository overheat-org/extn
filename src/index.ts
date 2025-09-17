import * as vite from 'vite';
import { type Config, ConfigManager } from './config';
import Scanner from './scanner';
import Transformer from './transformer';
import Graph from './graph';
import CodeGenerator from './codegen';
import BridgePlugin from './plugin';

class Compiler {
    private configManager: ConfigManager;
    scanner!: Scanner;
	graph!: Graph;
	transformer!: Transformer;
	codegen!: CodeGenerator;
    config!: Config;

    private async setup() {
        await this.configManager.setup();
        this.config = this.configManager.data;
        (this.config.vite!.plugins ??= []).push(BridgePlugin(this));

		
		this.graph = new Graph();
		this.transformer = new Transformer(this.graph);
        this.scanner = new Scanner(this.config, this.transformer);
		this.codegen = new CodeGenerator(this.graph);
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
