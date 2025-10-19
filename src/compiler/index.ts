import * as vite from 'vite';
import Scanner from './scanner';
import Transformer from './transformer';
import Graph from '../graph';
import CodeGenerator from './codegen';
import BridgePlugin from '../plugin';
import { ConfigManager, Config } from '../config';
import Analyzer from './analyzer';

class Compiler {
    configManager = new ConfigManager();
	graph = new Graph();
	codegen = new CodeGenerator(this.graph);
	transformer = new Transformer(this);
    scanner = new Scanner(this);
	analyzer = new Analyzer(this);
	
    config!: Config;

    async build(cwd = process.cwd()) {
        const module = (await this.scanner.scanModule(cwd))!;
		this.config = module.config;
        (this.config.vite!.plugins ??= []).unshift(BridgePlugin(this));
        await vite.build(this.config.vite);
    }
}

export default Compiler;
