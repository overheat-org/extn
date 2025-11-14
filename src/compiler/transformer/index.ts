import { CommandTransformer } from "./transformer.command";
import { ServiceTransformer } from "./transformer.service";
import Graph from "../graph";
import Analyzer from "../analyzer";
import CodeGenerator from "../codegen";
import Scanner from "../scanner";
import Parser from "../parser";

class Transformer {
	private parser = new Parser();
	private analyzer: Analyzer;
	private codegen: CodeGenerator;

	async transformService(path: string, source: string) {
		const ast = await this.parser.parseService(path, source);
		
		source = this.codegen.generateCode(ast);

		this.graph.addFile(path, source);
	}

	async transformCommand(path: string, code: string) {
		const ast = await this.parser.parseCommand(path, code);

		this.graph.addCommand(ast);
	}

	constructor(private graph: Graph, scanner: Scanner) {
		this.codegen = new CodeGenerator(graph);
		this.analyzer = new Analyzer(this.graph, scanner, this.parser);
		const observer = this.parser.observe();
		new CommandTransformer(observer);
		new ServiceTransformer(observer, graph, this.analyzer);
	}
}

export default Transformer;
