import Analyzer from "./analyzer";
import Graph from "./graph";

abstract class TransformerStep {
    abstract test: RegExp | ((file) => boolean) | boolean
}

class CommandTransformer extends TransformerStep {
    test = file => /\$[a-zA-Z\.0-9]+\.(t|j)sx?/.test(file.name);

    transform(id: string, content: string) {

    }
}

class DecoratorTransformer extends TransformerStep {
    test = true;
}

const transformers = {
    DecoratorTransformer,
    CommandTransformer
}

class Transformer {
    private steps: { [K in typeof transformers]: V };
    private analyzer: Analyzer;

    async transform(id: string, code: string) {
        const steps = this.analyzer.analyze(id, code);
        let index = 0;

        while(index < steps.length) {
            const step = steps[index];

            await step(id, code);

            index++;
        }
    }

    constructor(public graph: Graph) {
        this.analyzer = new Analyzer(this.steps, this.graph);
        this.steps = Object.fromEntries(
            Object
                .entries(transformers)
                .map(([key, Transformer]) => [
                    key,
                    new Transformer(this.steps, this.graph)
                ])
        );
    }
}

export default Transformer;
