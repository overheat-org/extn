import Analyzer from "./analyzer";
import Graph from "./graph";

class Transformer {
    private analyzer: Analyzer;

    async transform(id: string, code: string) {
        const steps = this.analyzer.analyzeModule(id, code);
        let index = 0;

        while(index < steps.length) {
            const step = steps[index];

            await step(id, code);

            index++;
        }
    }

	transformDecorator(code: string) {
		
	}

	transformCommand(code: string) {

	}

    constructor(public graph: Graph) {
        this.analyzer = new Analyzer(this, this.graph);
    }
}

export default Transformer;
