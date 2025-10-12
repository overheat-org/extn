import * as vite from 'vite';
import { type Config, ConfigManager } from './config';
import Scanner from './scanner';
import Transformer from './transformer';
import Graph from './graph';
import CodeGenerator from './codegen';
import BridgePlugin from './plugin';

class Compiler {
    private configManager = new ConfigManager();
	graph = new Graph();
	codegen = new CodeGenerator(this.graph);
	transformer = new Transformer(this.graph, this.codegen);
    scanner!: Scanner;
    config!: Config;

    private async setup() {
		const cwd = process.cwd();
		this.config = await this.configManager.resolve(cwd);
        (this.config.vite!.plugins ??= []).unshift(BridgePlugin(this));
		
        this.scanner = new Scanner(this.config, this.transformer);
    }

    async build() {
        await this.setup();
        await this.scanner.scan();
        await vite.build(this.config.vite);
    }
}

export default Compiler;
