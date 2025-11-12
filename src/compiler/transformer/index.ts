import { CommandTransformer } from "./transformer.command";
import { ServiceTransformer } from "./transformer.service";
import Graph from "../graph";
import Analyzer from "../analyzer";
import CodeGenerator from "../codegen";
import Scanner from "../scanner";

class Transformer {
	private analyzer: Analyzer;
	private codegen: CodeGenerator;

	async transformService(path: string, source: string) {
		const ast = await this.analyzer.analyzeService(path, source!);
		if(!ast) return;
		
		source = this.codegen.generateCode(ast);

		this.graph.addFile(path, source);
	}

	async transformCommand(path: string, code: string) {
		const node = await this.analyzer.analyzeCommand(path, code);
		if(!node) return;

		this.graph.addCommand(node);
	}

	constructor(private graph: Graph, scanner: Scanner) {
		this.codegen = new CodeGenerator(graph);
		this.analyzer = new Analyzer(this.graph, scanner);
		new CommandTransformer();
		new ServiceTransformer(graph);
	}
}

export default Transformer;
